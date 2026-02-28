export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { Prisma } from "@prisma/client";
import { getZonedStartOfDay, getZonedEndOfDay } from "@/lib/utils";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const shiftId = searchParams.get("shiftId");
  const queryBranchId = searchParams.get("branchId");
  const sessionBranchId = (session.user as any).branchId;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "100");
  const skip = (page - 1) * pageSize;

  const isSupervisor = (session.user as any).role === "SUPERVISOR";
  const isGlobalAdmin = (session.user as any).role === "ADMIN" || (session.user as any).role === "GERENTE";

  let targetBranchId = undefined;
  if (isSupervisor) targetBranchId = sessionBranchId;
  else if (isGlobalAdmin) targetBranchId = queryBranchId || undefined;
  else targetBranchId = sessionBranchId;

  const where: any = { AND: [] };
  if (shiftId) where.AND.push({ shiftId });
  else if (targetBranchId) where.AND.push({ branchId: targetBranchId });

  const queryUserId = searchParams.get("userId");
  if (queryUserId) where.AND.push({ userId: queryUserId });

  const isCajero = !isSupervisor && !isGlobalAdmin;
  if (isCajero) where.AND.push({ userId: session.user.id });

  if (startDate || endDate) {
    const dateRange: any = {};
    if (startDate) dateRange.gte = getZonedStartOfDay(startDate);
    if (endDate) dateRange.lte = getZonedEndOfDay(endDate);
    where.AND.push({ createdAt: dateRange });
  }

  const search = searchParams.get("search");
  if (search) {
    where.AND.push({
      OR: [
        { number: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { notes: { contains: search, mode: 'insensitive' } }
      ]
    });
  }

  const [totalSalesCount, totalSum] = await Promise.all([
    prisma.sale.count({ where }),
    prisma.sale.aggregate({ where, _sum: { total: true } })
  ]);

  const sales = await prisma.sale.findMany({
    where,
    include: {
      items: { include: { product: true, unit: true } },
      user: { select: { name: true } },
      branch: { select: { name: true } },
      customer: { select: { name: true, document: true } },
      paymentDetails: true
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize
  });

  return NextResponse.json({
    sales,
    pagination: {
      total: totalSalesCount,
      pages: Math.ceil(totalSalesCount / pageSize),
      currentPage: page,
      pageSize,
      totalAmount: Number(totalSum._sum?.total || 0)
    }
  });
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userId = session.user.id;
    const shift = await prisma.shift.findFirst({
      where: { userId, closedAt: null },
      select: { id: true, branchId: true }
    });
    if (!shift) return NextResponse.json({ error: "No hay turno abierto" }, { status: 400 });

    const branchId = shift.branchId || (session.user as any).branchId;
    if (!branchId) return NextResponse.json({ error: "Usuario sin sucursal asignada" }, { status: 400 });

    const body = await req.json();
    const {
      items,
      paymentMethod,
      cashReceived,
      discount = 0,
      priceListId,
      adjustment = 0,
      notes,
      customerId,
      paymentDetails = []
    } = body;

    if (!items?.length) return NextResponse.json({ error: "Carrito vacío" }, { status: 400 });

    const sale = await prisma.$transaction(async (tx) => {
      let total = new Prisma.Decimal(0);
      const saleItems = [];

      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) throw new Error(`Producto no encontrado: ${item.productId}`);

        const quantity = new Prisma.Decimal(item.quantity);
        const itemPrice = new Prisma.Decimal(item.price || product.basePrice);
        const itemDiscount = new Prisma.Decimal(item.discount || 0);
        const itemSubtotal = itemPrice.times(quantity).minus(itemDiscount);

        total = total.plus(itemSubtotal);

        saleItems.push({
          productId: item.productId,
          quantity,
          price: itemPrice,
          discount: itemDiscount,
          subtotal: itemSubtotal,
          unitId: item.unitId || product.baseUnitId
        });

        await tx.stock.upsert({
          where: { productId_branchId: { productId: item.productId, branchId: branchId } },
          update: { quantity: { decrement: quantity } },
          create: { productId: item.productId, branchId: branchId, quantity: quantity.negated() }
        });
      }

      const finalTotal = total.minus(new Prisma.Decimal(discount));
      const reqAdjustment = new Prisma.Decimal(adjustment);

      const saleData: any = {
        userId,
        branchId,
        shiftId: shift.id,
        priceListId,
        total: finalTotal,
        discount: new Prisma.Decimal(discount),
        paymentMethod,
        cashReceived: (paymentMethod === "EFECTIVO" || paymentMethod === "MIXTO") ? (cashReceived || 0) : null,
        adjustment: reqAdjustment,
        notes,
        items: { create: saleItems },
        customerId
      };

      // 1. Handle Payment Details (Mixed)
      if (paymentMethod === "MIXTO" && paymentDetails.length > 0) {
        saleData.paymentDetails = {
          create: paymentDetails.map((pd: any) => ({
            method: pd.method,
            amount: new Prisma.Decimal(pd.amount)
          }))
        };
      }

      const createdSale = await tx.sale.create({
        data: saleData,
        include: { items: true, paymentDetails: true }
      });

      // 2. Handle Account Receivable (CUENTA_CORRIENTE)
      if (paymentMethod === "CUENTA_CORRIENTE" || (paymentMethod === "MIXTO" && paymentDetails.some((pd: any) => pd.method === "CUENTA_CORRIENTE"))) {
        if (!customerId) throw new Error("Cliente requerido para venta en cuenta corriente");

        const debtAmount = paymentMethod === "CUENTA_CORRIENTE"
          ? finalTotal
          : new Prisma.Decimal(paymentDetails.find((pd: any) => pd.method === "CUENTA_CORRIENTE").amount);

        await tx.customer.update({
          where: { id: customerId },
          data: { balance: { increment: debtAmount } }
        });

        await tx.customerTransaction.create({
          data: {
            customerId,
            saleId: createdSale.id,
            type: "SALE",
            amount: debtAmount,
            description: `Venta #${createdSale.number}`
          }
        });
      }

      return createdSale;
    });

    return NextResponse.json(sale);
  } catch (error: any) {
    console.error("❌ Error en POST /api/sales:", error);
    return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
  }
}

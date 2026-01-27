export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const shiftId = searchParams.get("shiftId");
  const queryBranchId = searchParams.get("branchId"); // [NEW] Read from URL
  const sessionBranchId = (session.user as any).branchId;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const isSupervisor = (session.user as any).role === "SUPERVISOR";
  const isGlobalAdmin = (session.user as any).role === "ADMIN" || (session.user as any).role === "GERENTE";

  let targetBranchId = undefined;

  if (isSupervisor) {
    // Supervisor: Forced to session branch
    targetBranchId = sessionBranchId;
  } else if (isGlobalAdmin) {
    // Admin: Use URL param if exists, otherwise All
    targetBranchId = queryBranchId || undefined;
  } else {
    // Cajero: Forced to session branch (usually same as supervisor logic)
    targetBranchId = sessionBranchId;
  }

  const where: any = shiftId
    ? { shiftId }
    : (targetBranchId ? { branchId: targetBranchId } : {});

  // If requesting specific user
  const queryUserId = searchParams.get("userId");
  if (queryUserId) where.userId = queryUserId;

  // If Cajero (and not supervisor/admin), force userId? 
  // Code previously forced userId: session.user.id if !isSupervisor. 
  // Let's restore that logic for Cajeros.
  const isCajero = !isSupervisor && !isGlobalAdmin;
  if (isCajero) {
    where.userId = session.user.id;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
    if (endDate) where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
  }

  const sales = await (prisma as any).sale.findMany({
    where,
    include: {
      items: { include: { product: true, unit: true } },
      user: { select: { name: true } },
      branch: { select: { name: true } },
      paymentDetails: true
    },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(sales);
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userId = session.user.id;
    let branchId = (session.user as any).branchId;

    // Fetch System Settings for Rounding
    const settings = await prisma.systemSetting.findUnique({ where: { key: "global" } });
    const decimals = settings?.useDecimals ? 2 : 0;

    // Fallback: If session branchId is missing (stale session), fetch from DB
    if (!branchId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { branchId: true }
      });
      if (user?.branchId) {
        branchId = user.branchId;
        console.log("⚠️ BranchID recuperado de DB (Sesión obsoleta):", branchId);
      }
    }

    if (!branchId) {
      console.error("❌ Error: Usuario sin sucursal asignada", { userId });
      return NextResponse.json({ error: "El usuario no tiene una sucursal asignada. Contacte al administrador." }, { status: 400 });
    }

    const shift = await prisma.shift.findFirst({
      where: { userId, closedAt: null }
    });
    if (!shift) return NextResponse.json({ error: "No hay turno abierto" }, { status: 400 });

    const body = await req.json();
    const {
      items,
      paymentMethod,
      cashReceived,
      paymentDetails,
      discount = 0,
      priceListId,
      adjustment = 0,
      notes
    } = body;

    if (!items?.length) return NextResponse.json({ error: "Carrito vacío" }, { status: 400 });

    // Pre-fetch products to minimize work inside the transaction
    const productIds = items.map((i: any) => i.productId);
    const products = await (prisma as any).product.findMany({
      where: { id: { in: productIds } },
      include: { baseUnit: true }
    });

    const sale = await (prisma as any).$transaction(async (tx: any) => {
      // Initialize with Prisma.Decimal to ensure precision
      let total = new Prisma.Decimal(0);
      const saleItems = [];

      for (const item of items) {
        const product = products.find((p: any) => p.id === item.productId);
        if (!product) {
          console.error("❌ Producto no encontrado:", item.productId);
          throw new Error(`Producto no encontrado: ${item.productId}`);
        }

        // Ensure everything is a Decimal before math
        // item.price is number from JSON, product.basePrice is Decimal from DB
        const itemPrice = item.price
          ? new Prisma.Decimal(item.price)
          : new Prisma.Decimal(product.basePrice || 0);

        const quantity = new Prisma.Decimal(item.quantity);
        const discount = new Prisma.Decimal(item.discount || 0);

        // precise calculation: (price * qty) - discount
        // Round to configured decimals for currency consistency
        let itemSubtotal = itemPrice.times(quantity).minus(discount);

        // Manual Rounding using Number logic (Prisma Decimal lacks flexible round)
        // Convert to number, round, back to Decimal. Safe for currency scale.
        const numericSubtotal = itemSubtotal.toNumber();
        const factor = Math.pow(10, decimals);
        const roundedSubtotal = Math.round((numericSubtotal + Number.EPSILON) * factor) / factor;

        itemSubtotal = new Prisma.Decimal(roundedSubtotal);

        total = total.plus(itemSubtotal);

        saleItems.push({
          product: { connect: { id: item.productId } },
          quantity: quantity,
          price: itemPrice,
          discount: discount,
          subtotal: itemSubtotal,
          ...((item.unitId || (product as any).baseUnitId) ? { unit: { connect: { id: item.unitId || (product as any).baseUnitId } } } : {})
        });

        const targetBranchId = (product as any).branchId || branchId;

        await tx.stock.upsert({
          where: { productId_branchId: { productId: item.productId, branchId: targetBranchId } },
          update: { quantity: { decrement: quantity } }, // Prisma handles Decimal decrement
          create: { productId: item.productId, branchId: targetBranchId, quantity: quantity.negated() }
        });
      }

      const reqDiscount = new Prisma.Decimal(discount || 0);
      const reqAdjustment = new Prisma.Decimal(adjustment || 0);
      const finalTotal = total.minus(reqDiscount);

      let change = null;
      if (paymentMethod === "MIXTO" && paymentDetails && paymentDetails.length > 0) {
        // Calculate total tendered from all details
        const totalTendered = paymentDetails.reduce((sum: any, pd: any) => sum + Number(pd.amount), 0);
        const tenderedDec = new Prisma.Decimal(totalTendered);
        change = tenderedDec.minus(finalTotal).minus(reqAdjustment);
      } else if (cashReceived) {
        const received = new Prisma.Decimal(cashReceived);
        // change = received - finalTotal - adjustment
        change = received.minus(finalTotal).minus(reqAdjustment);
      }

      const saleData: any = {
        user: { connect: { id: userId } },
        branch: { connect: { id: branchId } },
        shift: { connect: { id: shift.id } },
        total: finalTotal,
        discount: reqDiscount,
        paymentMethod: paymentMethod as any,
        cashReceived: (paymentMethod === "EFECTIVO" || paymentMethod === "MIXTO") ? (cashReceived || 0) : null,
        change: change,
        adjustment: reqAdjustment,
        notes: notes || null,
        items: { create: saleItems }
      };

      if (priceListId) {
        saleData.priceList = { connect: { id: priceListId } };
      }

      if (paymentDetails && paymentDetails.length > 0) {
        saleData.paymentDetails = {
          create: paymentDetails.map((pd: any) => ({
            method: pd.method as any,
            amount: new Prisma.Decimal(pd.amount),
            transactionId: pd.transactionId || null
          }))
        };
      }

      return await tx.sale.create({
        data: saleData,
        include: { items: { include: { product: true, unit: true } }, paymentDetails: true }
      });
    }, {
      maxWait: 5000,
      timeout: 15000
    });

    console.log("✅ Venta procesada exitosamente:", (sale as any)?.id);
    return NextResponse.json(sale);
  } catch (error: any) {
    console.error("❌ Error en POST /api/sales:", error);
    // Enviar mas detalle del error Prisma
    const detail = JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return NextResponse.json(
      { error: error.message || "Error interno del servidor", detail },
      { status: 500 }
    );
  }
}

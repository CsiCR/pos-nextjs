export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const product = await (prisma as any).product.findUnique({
    where: { id: params.id },
    include: { category: true, baseUnit: true, stocks: { include: { branch: true } }, prices: true }
  });
  if (!product) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(product);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!session || !["SUPERVISOR", "ADMIN", "GERENTE"].includes(user?.role)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const data = await req.json();
    const branchId = user?.branchId;
    const isManager = user.role === "ADMIN" || user.role === "GERENTE";

    const currentProduct = await (prisma as any).product.findUnique({ where: { id: params.id }, include: { stocks: true } });
    if (!currentProduct) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

    if (isManager && data.active === false) {
      const hasStock = currentProduct.stocks?.some((s: any) => Number(s.quantity) > 0);
      if (hasStock) {
        return NextResponse.json({
          error: "No se puede desactivar un producto con stock en existencia.",
          details: "Asegúrate de que el stock sea 0 en todas las sucursales antes de desactivar el producto."
        }, { status: 400 });
      }
    }

    // Existing global/master product data is managed only by GERENTE/ADMIN.
    if (isManager) {
      await (prisma as any).product.update({
        where: { id: params.id },
        data: {
          name: data.name,
          basePrice: data.basePrice !== undefined ? Number(data.basePrice) : undefined,
          baseUnitId: data.baseUnitId !== undefined ? (data.baseUnitId || null) : undefined,
          categoryId: data.categoryId !== undefined ? (data.categoryId || null) : undefined,
          minStock: data.minStock !== undefined ? Number(data.minStock) : undefined,
          active: data.active !== undefined ? Boolean(data.active) : undefined,
          ean: data.ean !== undefined ? (data.ean || null) : undefined
        }
      });
    }

    // Price permissions: managers may update any list; supervisors only lists owned by their branch.
    if (Array.isArray(data.prices)) {
      let allowedPriceListIds: Set<string> | null = null;
      if (!isManager) {
        if (!branchId) return NextResponse.json({ error: "El supervisor no tiene una sucursal asignada" }, { status: 403 });
        const requestedIds = data.prices.map((p: any) => p.priceListId).filter(Boolean);
        const lists = requestedIds.length
          ? await (prisma as any).priceList.findMany({ where: { id: { in: requestedIds }, branchId }, select: { id: true } })
          : [];
        allowedPriceListIds = new Set(lists.map((l: any) => l.id));
      }

      for (const p of data.prices) {
        if (!p.priceListId || (allowedPriceListIds && !allowedPriceListIds.has(p.priceListId))) continue;
        const priceVal = Number(p.price);
        if (isNaN(priceVal)) continue;
        await (prisma as any).productPrice.upsert({
          where: { productId_priceListId: { productId: params.id, priceListId: p.priceListId } },
          update: { price: priceVal },
          create: { productId: params.id, priceListId: p.priceListId, price: priceVal }
        });
      }
    }

    // Supervisor stock is always restricted to their own branch.
    if (branchId && (data.stock !== undefined || data.minStock !== undefined)) {
      const stockVal = data.stock !== undefined ? Number(data.stock) : undefined;
      const minStockVal = data.minStock !== undefined ? Number(data.minStock) : undefined;
      const updateData: any = {};
      if (stockVal !== undefined && !isNaN(stockVal)) updateData.quantity = stockVal;
      if (minStockVal !== undefined && !isNaN(minStockVal)) updateData.minStock = minStockVal;

      if (Object.keys(updateData).length) {
        await (prisma as any).stock.upsert({
          where: { productId_branchId: { productId: params.id, branchId } },
          update: updateData,
          create: { productId: params.id, branchId, quantity: stockVal || 0, minStock: minStockVal || 0 }
        });
      }
    }

    // Multi-branch stock editing is management-only.
    if (isManager && Array.isArray(data.branchStocks)) {
      for (const s of data.branchStocks) {
        if (!s.branchId) continue;
        const msVal = s.minStock !== undefined ? Number(s.minStock) : undefined;
        const qVal = s.quantity !== undefined ? Number(s.quantity) : undefined;
        if ((msVal === undefined || isNaN(msVal)) && (qVal === undefined || isNaN(qVal))) continue;
        const updateData: any = {};
        if (msVal !== undefined && !isNaN(msVal)) updateData.minStock = msVal;
        if (qVal !== undefined && !isNaN(qVal)) updateData.quantity = qVal;
        await (prisma as any).stock.upsert({
          where: { productId_branchId: { productId: params.id, branchId: s.branchId } },
          update: updateData,
          create: { productId: params.id, branchId: s.branchId, quantity: qVal || 0, minStock: msVal || 0 }
        });
      }
    }

    const updatedProduct = await (prisma as any).product.findUnique({
      where: { id: params.id },
      include: { category: true, baseUnit: true, stocks: { include: { branch: true } }, prices: true }
    });
    return NextResponse.json(updatedProduct);
  } catch (error: any) {
    console.error(`[ERROR] PUT Product ${params.id}:`, error);
    return NextResponse.json({ error: "Error interno del servidor al actualizar el producto", message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  const branchId = user?.branchId;
  if (!session || !["ADMIN", "GERENTE", "SUPERVISOR"].includes(user?.role)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const product = await (prisma as any).product.findUnique({
    where: { id: params.id },
    include: { stocks: branchId ? { where: { branchId } } : false }
  });
  if (!product) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (user.role === "SUPERVISOR") {
    if (!branchId) return NextResponse.json({ error: "Supervisor sin sucursal asignada" }, { status: 403 });
    const branchStock = product.stocks?.[0];
    if (branchStock && (Number(branchStock.quantity) !== 0 || Number(branchStock.minStock) !== 0)) {
      return NextResponse.json({
        error: "No se puede ocultar un producto con stock activo o mínimo configurado.",
        details: "Asegúrate de que el stock y el mínimo sean 0 para desvincularlo localmente."
      }, { status: 400 });
    }
    if (branchStock) {
      await (prisma as any).stock.delete({ where: { productId_branchId: { productId: params.id, branchId } } });
    }
    return NextResponse.json({ success: true, message: "Producto desvinculado de esta sucursal." });
  }

  const totalStock = await (prisma as any).stock.aggregate({ where: { productId: params.id }, _sum: { quantity: true } });
  if (Number(totalStock._sum.quantity || 0) > 0) {
    return NextResponse.json({
      error: "No se puede eliminar un producto con stock en existencia.",
      details: "Asegúrate de que el stock sea 0 en todas las sucursales antes de eliminar."
    }, { status: 400 });
  }

  await (prisma as any).product.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ success: true });
}

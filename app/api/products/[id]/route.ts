export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const branchId = (session?.user as any)?.branchId;

  const product = await (prisma as any).product.findUnique({
    where: { id: params.id },
    include: {
      category: true,
      baseUnit: true,
      stocks: { include: { branch: true } },
      prices: true
    }
  });
  if (!product) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(product);
}

// Helper to check ownership
const canEditProduct = (userRole: string, userBranchId: string | null, productBranchId: string | null) => {
  if (userRole === "ADMIN" || userRole === "GERENTE") return true;
  if (userRole === "SUPERVISOR") {
    // Can edit IF product belongs to their branch
    return productBranchId === userBranchId;
  }
  return false;
};

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!session || (user?.role !== "SUPERVISOR" && user?.role !== "ADMIN" && user?.role !== "GERENTE")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const data = await req.json();
    const branchId = user?.branchId;

    console.log(`[DEBUG] PUT Product ${params.id} by ${user.name} (${user.role})`);
    console.log(`[DEBUG] Received Data:`, JSON.stringify(data, null, 2));

    // Fetch current product to check ownership
    const currentProduct = await (prisma as any).product.findUnique({
      where: { id: params.id }
    });

    if (!currentProduct) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

    // Permissions: Admin and Gerente can ALWAYS edit everything.
    // Supervisor can ALWAYS edit metadata (Collaborative Global data).
    const canEditMetadata = user.role === "ADMIN" || user.role === "GERENTE" || user.role === "SUPERVISOR";

    if (canEditMetadata) {
      console.log(`[DEBUG] Updating metadata for product ${params.id}`);
      await (prisma as any).product.update({
        where: { id: params.id },
        data: {
          name: data.name,
          basePrice: Number(data.basePrice) || 0,
          baseUnitId: data.baseUnitId || null,
          categoryId: data.categoryId || null,
          minStock: data.minStock !== undefined ? Number(data.minStock) : undefined,
          active: data.active !== undefined ? Boolean(data.active) : undefined,
          ean: data.ean || null
        }
      });
    }

    // Update prices per list if provided
    if (canEditMetadata && data.prices && Array.isArray(data.prices)) {
      console.log(`[DEBUG] Updating ${data.prices.length} prices`);
      for (const p of data.prices) {
        if (!p.priceListId) continue;
        const priceVal = Number(p.price);
        if (isNaN(priceVal)) continue;

        await (prisma as any).productPrice.upsert({
          where: {
            productId_priceListId: {
              productId: params.id,
              priceListId: p.priceListId
            }
          },
          update: { price: priceVal },
          create: {
            productId: params.id,
            priceListId: p.priceListId,
            price: priceVal
          }
        });
      }
    }

    // Update branch stock and branch minStock for the CURRENT branch (Legacy/Supervisor support)
    if (branchId && (data.stock !== undefined || data.minStock !== undefined)) {
      const stockVal = data.stock !== undefined ? Number(data.stock) : undefined;
      const minStockVal = data.minStock !== undefined ? Number(data.minStock) : undefined;

      console.log(`[DEBUG] Updating branch stock/minStock for ${branchId}`);

      const updateData: any = {};
      if (stockVal !== undefined) updateData.quantity = stockVal;
      if (minStockVal !== undefined) updateData.minStock = minStockVal;

      const createData: any = { productId: params.id, branchId, quantity: stockVal || 0, minStock: minStockVal || 0 };

      await (prisma as any).stock.upsert({
        where: {
          productId_branchId: { productId: params.id, branchId }
        },
        update: updateData,
        create: createData
      });
    }

    // [NEW] Update multiple branch stocks if provided (Management modal support)
    if (canEditMetadata && data.branchStocks && Array.isArray(data.branchStocks)) {
      console.log(`[DEBUG] Updating ${data.branchStocks.length} branch stocks`);
      for (const s of data.branchStocks) {
        if (!s.branchId) continue;

        const msVal = s.minStock !== undefined ? Number(s.minStock) : undefined;
        const qVal = s.quantity !== undefined ? Number(s.quantity) : undefined;

        if ((msVal === undefined || isNaN(msVal)) && (qVal === undefined || isNaN(qVal))) continue;

        const updateData: any = {};
        if (msVal !== undefined && !isNaN(msVal)) updateData.minStock = msVal;
        if (qVal !== undefined && !isNaN(qVal)) updateData.quantity = qVal;

        await (prisma as any).stock.upsert({
          where: {
            productId_branchId: { productId: params.id, branchId: s.branchId }
          },
          update: updateData,
          create: {
            productId: params.id,
            branchId: s.branchId,
            quantity: qVal || 0,
            minStock: msVal || 0
          }
        });
      }
    }

    // Final fetch
    // Final fetch: include all stocks for better UI feedback
    const updatedProduct = await (prisma as any).product.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        baseUnit: true,
        stocks: { include: { branch: true } },
        prices: true
      }
    });

    return NextResponse.json(updatedProduct);
  } catch (error: any) {
    console.error(`[ERROR] PUT Product ${params.id}:`, error);
    return NextResponse.json({
      error: "Error interno del servidor al actualizar el producto",
      message: error.message,
      detail: error
    }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  const branchId = user?.branchId;

  if (!session || (user?.role !== "ADMIN" && user?.role !== "GERENTE" && user?.role !== "SUPERVISOR")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  // Fetch product to check ownership
  const product = await (prisma as any).product.findUnique({ where: { id: params.id } });
  if (!product) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const isOwner = canEditProduct(user.role, branchId, product.branchId);

  if (!isOwner) {
    return NextResponse.json({ error: "No tienes permiso para eliminar este producto (Es Global o de otra sucursal)." }, { status: 403 });
  }

  // Soft Delete
  await prisma.product.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ success: true });
}

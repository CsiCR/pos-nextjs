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
      stocks: branchId ? { where: { branchId: branchId as any } } : true,
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
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!session || (user?.role !== "SUPERVISOR" && user?.role !== "ADMIN")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const data = await req.json();
  const branchId = user?.branchId;

  // Fetch current product to check ownership
  const currentProduct = await (prisma as any).product.findUnique({
    where: { id: params.id }
  });

  if (!currentProduct) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

  const isOwner = canEditProduct(user.role, branchId, currentProduct.branchId);

  // If Supervisor is NOT owner (e.g. it's a Global product), they CANNOT change product details (Name, Price, etc.)
  // But they CAN update their own stock/prices (if we allowed it).
  // Current logic: We only execute the core product update if they are the owner.

  if (isOwner) {
    await (prisma as any).product.update({
      where: { id: params.id },
      data: {
        name: data.name,
        basePrice: Number(data.basePrice) || 0,
        baseUnitId: data.baseUnitId,
        categoryId: data.categoryId,
        minStock: data.minStock !== undefined ? Number(data.minStock) : undefined, // Update minStock if provided
        ean: data.ean || null
      }
    });
  }

  // Update prices per list if provided
  // Assumption: Supervisors shouldn't change global prices unless they own the product.
  if (isOwner && data.prices && Array.isArray(data.prices)) {
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

  // Update branch stock if provided (ALWAYS ALLOWED for Supervisor in their own branch, even if product is Global)
  if (branchId && data.stock !== undefined) {
    const stockVal = Number(data.stock) || 0;
    await (prisma as any).stock.upsert({
      where: {
        productId_branchId: { productId: params.id, branchId }
      },
      update: { quantity: stockVal },
      create: { productId: params.id, branchId, quantity: stockVal }
    });
  }

  // Final fetch
  const updatedProduct = await (prisma as any).product.findUnique({
    where: { id: params.id },
    include: {
      category: true,
      baseUnit: true,
      stocks: { where: { branchId: (branchId as any) || undefined } },
      prices: true
    }
  });

  return NextResponse.json(updatedProduct);
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

export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const products = await prisma.product.findMany({
    where: {
      active: true,
      OR: [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { ean: { contains: search, mode: "insensitive" } }
      ]
    },
    include: { category: true },
    orderBy: { name: "asc" }
  });
  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPERVISOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const data = await req.json();
  const code = data.code || `INT${Date.now()}`;
  const product = await prisma.product.create({
    data: { code, ean: data.ean || null, name: data.name, price: data.price, stock: data.stock || 0, categoryId: data.categoryId }
  });
  return NextResponse.json(product);
}

export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  
  const { searchParams } = new URL(req.url);
  const shiftId = searchParams.get("shiftId");
  
  const where = session.user.role === "SUPERVISOR" 
    ? (shiftId ? { shiftId } : {})
    : { userId: session.user.id };
  
  const sales = await prisma.sale.findMany({
    where,
    include: { items: { include: { product: true } }, user: { select: { name: true } } },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(sales);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  
  const shift = await prisma.shift.findFirst({
    where: { userId: session.user.id, closedAt: null }
  });
  if (!shift) return NextResponse.json({ error: "No hay turno abierto" }, { status: 400 });
  
  const { items, paymentMethod, cashReceived } = await req.json();
  if (!items?.length) return NextResponse.json({ error: "Carrito vac\u00edo" }, { status: 400 });
  
  let total = 0;
  const saleItems = [];
  
  for (const item of items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product) continue;
    const subtotal = product.price * item.quantity;
    total += subtotal;
    saleItems.push({ productId: item.productId, quantity: item.quantity, price: product.price, subtotal });
    await prisma.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
  }
  
  const change = paymentMethod === "EFECTIVO" && cashReceived ? cashReceived - total : null;
  
  const sale = await prisma.sale.create({
    data: {
      userId: session.user.id,
      shiftId: shift.id,
      total,
      paymentMethod,
      cashReceived: paymentMethod === "EFECTIVO" ? cashReceived : null,
      change,
      items: { create: saleItems }
    },
    include: { items: { include: { product: true } } }
  });
  
  return NextResponse.json(sale);
}

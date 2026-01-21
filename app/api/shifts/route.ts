export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  
  const shifts = await prisma.shift.findMany({
    where: session.user.role === "SUPERVISOR" ? {} : { userId: session.user.id },
    include: { user: { select: { name: true, email: true } }, _count: { select: { sales: true } } },
    orderBy: { openedAt: "desc" }
  });
  return NextResponse.json(shifts);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  
  const openShift = await prisma.shift.findFirst({
    where: { userId: session.user.id, closedAt: null }
  });
  if (openShift) return NextResponse.json({ error: "Ya tienes un turno abierto" }, { status: 400 });
  
  const { initialCash } = await req.json();
  const shift = await prisma.shift.create({
    data: { userId: session.user.id, initialCash: initialCash || 0 }
  });
  return NextResponse.json(shift);
}

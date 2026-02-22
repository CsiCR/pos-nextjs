export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const role = (session.user as any)?.role;
  const branchId = (session.user as any)?.branchId;
  const userId = session.user.id;

  const where: any = {};

  if (role === "ADMIN" || role === "GERENTE") {
    // Admin/Gerente: Ven todo, sin filtro adicional
  } else if (role === "SUPERVISOR") {
    // Supervisor: Ve turnos de su sucursal
    if (branchId) {
      where.branchId = branchId;
    } else {
      where.userId = userId;
    }
  } else {
    // Cajero y otros: Solo ven sus propios turnos
    where.userId = userId;
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "100");
  const skip = (page - 1) * pageSize;

  const totalShifts = await prisma.shift.count({ where });

  const shifts = await prisma.shift.findMany({
    where,
    include: {
      user: { select: { name: true, email: true } },
      branch: { select: { name: true } },
      _count: { select: { sales: true } }
    },
    orderBy: { openedAt: "desc" },
    skip,
    take: pageSize
  });
  return NextResponse.json({
    shifts,
    pagination: {
      total: totalShifts,
      pages: Math.ceil(totalShifts / pageSize),
      currentPage: page,
      pageSize
    }
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const openShift = await prisma.shift.findFirst({
    where: { userId: session.user.id, closedAt: null }
  });
  if (openShift) return NextResponse.json({ error: "Ya tienes un turno abierto" }, { status: 400 });

  const { initialCash, branchId } = await req.json();
  const shift = await prisma.shift.create({
    data: {
      userId: session.user.id,
      initialCash: initialCash || 0,
      branchId: branchId || (session.user as any).branchId || null
    }
  });
  return NextResponse.json(shift);
}

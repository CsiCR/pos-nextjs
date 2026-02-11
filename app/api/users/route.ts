export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "SUPERVISOR" && session.user.role !== "ADMIN" && session.user.role !== "GERENTE")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const userRole = (session.user as any).role;
  const userBranchId = (session.user as any).branchId;
  const isAdmin = userRole === "ADMIN";

  const whereClause: any = { active: true };

  if (userRole === "SUPERVISOR" && !isAdmin) {
    if (userBranchId) {
      // Strict scoping: Supervisor only sees users of their branch
      whereClause.branchId = userBranchId;
    } else {
      // Fallback: If supervisor has no branch, they shouldn't see anyone (or maybe unassigned?)
      // Safer to return empty or just themselves.
      whereClause.branchId = "non-existent";
    }
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true, branchId: true, branch: { select: { name: true } } },
    orderBy: { name: "asc" }
  });
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "SUPERVISOR" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { email, password, name, role, branchId } = await req.json();

  // Supervisor Restrictions
  if (session.user.role === "SUPERVISOR") {
    // 1. Can only create CAJEROs
    if (role && role !== "CAJERO") {
      return NextResponse.json({ error: "Los Supervisores solo pueden crear Cajeros" }, { status: 403 });
    }
    // 2. Can only create in their own branch
    const userBranchId = (session.user as any).branchId;
    if (branchId && branchId !== userBranchId) {
      return NextResponse.json({ error: "Solo puedes crear usuarios para tu propia sucursal" }, { status: 403 });
    }
  }

  const hashed = await bcrypt.hash(password, 10);
  try {
    const userBranchId = (session.user as any).branchId;
    const finalBranchId = session.user.role === "SUPERVISOR" ? userBranchId : (branchId && branchId.trim() !== "" ? branchId : null);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        role: session.user.role === "SUPERVISOR" ? "CAJERO" : (role || "CAJERO"),
        branchId: finalBranchId
      }
    });
    return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role, branchId: user.branchId });
  } catch (error: any) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Error al crear usuario: " + (error.message || error) }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  
  const shift = await prisma.shift.findUnique({
    where: { id: params.id },
    include: { sales: true }
  });
  
  if (!shift) return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  if (shift.closedAt) return NextResponse.json({ error: "Turno ya cerrado" }, { status: 400 });
  
  const { declaredAmount, discrepancyReason, discrepancyNote } = await req.json();
  
  const cashSales = shift.sales.filter(s => s.paymentMethod === "EFECTIVO").reduce((sum, s) => sum + s.total, 0);
  const expectedAmount = (shift.initialCash || 0) + cashSales;
  const discrepancy = declaredAmount - expectedAmount;
  
  if (Math.abs(discrepancy) > 0.01 && !discrepancyReason) {
    return NextResponse.json({ error: "Debe justificar la diferencia", expectedAmount, discrepancy }, { status: 400 });
  }
  
  const updated = await prisma.shift.update({
    where: { id: params.id },
    data: {
      closedAt: new Date(),
      declaredAmount,
      expectedAmount,
      discrepancy: Math.abs(discrepancy) > 0.01 ? discrepancy : 0,
      discrepancyReason: Math.abs(discrepancy) > 0.01 ? discrepancyReason : null,
      discrepancyNote: Math.abs(discrepancy) > 0.01 ? discrepancyNote : null
    }
  });
  return NextResponse.json(updated);
}

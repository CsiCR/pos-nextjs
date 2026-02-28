export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { Prisma } from "@prisma/client";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const shift = await prisma.shift.findUnique({
    where: { id: params.id },
    include: {
      sales: true
    }
  });

  if (!shift) return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 });
  if (shift.closedAt) return NextResponse.json({ error: "Turno ya cerrado" }, { status: 400 });

  const { declaredAmount, discrepancyReason, discrepancyNote } = await req.json();

  const cashSales = shift.sales.reduce((sum: any, s: any) => {
    let cashAmount = new Prisma.Decimal(0);

    if (s.paymentMethod === "EFECTIVO") {
      // Must include adjustment (extra cash kept or small loss)
      cashAmount = s.total.plus(s.adjustment || 0);
    } else if (s.paymentMethod === "MIXTO") {
      // For MIXTO without details, we consider the whole amount as non-cash (safe default)
      // or we could look at total if we assume it was paid.
      // But in legacy schema, MIXTO was probably not used or handled differently.
      cashAmount = new Prisma.Decimal(0);
    }

    return sum.plus(cashAmount);
  }, new Prisma.Decimal(0));

  // Subtract change given (assuming change comes from cash drawer)
  // Ensure we don't subtract negative change (legacy bugs)
  const totalChange = shift.sales.reduce((sum: any, s: any) => {
    const ch = Number(s.change || 0);
    return sum.plus(ch > 0 ? ch : 0);
  }, new Prisma.Decimal(0));

  const initialCash = shift.initialCash || new Prisma.Decimal(0);
  const expectedAmount = initialCash.plus(cashSales).minus(totalChange);

  const declaredDec = new Prisma.Decimal(declaredAmount || 0);
  const discrepancy = declaredDec.minus(expectedAmount);

  // Use .abs().toNumber() for comparison
  const discrepancyVal = discrepancy.abs().toNumber();

  if (discrepancyVal > 0.01 && !discrepancyReason) {
    return NextResponse.json({
      error: "Debe justificar la diferencia",
      expectedAmount: expectedAmount.toNumber(),
      discrepancy: discrepancy.toNumber()
    }, { status: 400 });
  }

  const updated = await prisma.shift.update({
    where: { id: params.id },
    data: {
      closedAt: new Date(),
      declaredAmount: declaredDec,
      expectedAmount: expectedAmount,
      discrepancy: discrepancyVal > 0.01 ? discrepancy : new Prisma.Decimal(0),
      discrepancyReason: discrepancyVal > 0.01 ? discrepancyReason : null,
      discrepancyNote: discrepancyVal > 0.01 ? discrepancyNote : null
    }
  });
  return NextResponse.json(updated);
}

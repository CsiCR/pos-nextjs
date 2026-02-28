import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { declaredAmount, discrepancyReason, discrepancyNote } = body;

    // Fetch shift with all its sales and payment details
    const shift = await prisma.shift.findUnique({
      where: { id: params.id },
      include: {
        sales: {
          include: {
            paymentDetails: true
          }
        }
      }
    });

    if (!shift || shift.closedAt) {
      return NextResponse.json({ error: "Turno no encontrado o ya cerrado" }, { status: 400 });
    }

    // Calculate expected amount based on cash movements
    // Shift initial cash + EFECTIVO sales (Single or Mixed parts)
    const cashSales = shift.sales.reduce((sum, s) => {
      if (s.paymentMethod === "EFECTIVO") return sum + Number(s.total) + Number(s.adjustment);
      if (s.paymentMethod === "MIXTO") {
        const cashPart = s.paymentDetails.find(pd => pd.method === "EFECTIVO");
        return sum + Number(cashPart?.amount || 0);
      }
      return sum;
    }, 0);

    const expectedAmount = Number(shift.initialCash) + cashSales;
    const discrepancy = Number(declaredAmount) - expectedAmount;

    const closedShift = await prisma.shift.update({
      where: { id: params.id },
      data: {
        closedAt: new Date(),
        declaredAmount: Number(declaredAmount),
        expectedAmount,
        discrepancy,
        discrepancyReason,
        discrepancyNote
      }
    });

    return NextResponse.json(closedShift);
  } catch (error: any) {
    console.error("Error closing shift:", error);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

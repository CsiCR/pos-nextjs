import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const userId = session.user.id;

  try {
    const shift = await prisma.shift.findFirst({
      where: { userId, closedAt: null },
      include: {
        branch: true,
        sales: {
          include: {
            paymentDetails: true
          }
        }
      }
    });

    return NextResponse.json(shift);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Error" }, { status: 500 });
  }
}

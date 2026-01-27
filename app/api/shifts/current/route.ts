export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const shift = await prisma.shift.findFirst({
    where: { userId: session.user.id, closedAt: null },
    include: {
      sales: {
        include: {
          items: { include: { product: true } },
          paymentDetails: true
        }
      }
    }
  });
  return NextResponse.json(shift);
}

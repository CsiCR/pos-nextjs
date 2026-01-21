export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  
  const isSupervisor = session.user.role === "SUPERVISOR";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (isSupervisor) {
    const [totalSales, todaySales, products, users, salesByMethod] = await Promise.all([
      prisma.sale.aggregate({ _sum: { total: true }, _count: true }),
      prisma.sale.aggregate({ where: { createdAt: { gte: today } }, _sum: { total: true }, _count: true }),
      prisma.product.count({ where: { active: true } }),
      prisma.user.count({ where: { active: true } }),
      prisma.sale.groupBy({ by: ["paymentMethod"], _sum: { total: true }, _count: true })
    ]);
    return NextResponse.json({
      totalSales: totalSales._sum.total || 0,
      totalCount: totalSales._count || 0,
      todaySales: todaySales._sum.total || 0,
      todayCount: todaySales._count || 0,
      products,
      users,
      salesByMethod
    });
  } else {
    const shift = await prisma.shift.findFirst({
      where: { userId: session.user.id, closedAt: null },
      include: { sales: true }
    });
    const shiftSales = shift?.sales?.reduce((sum, s) => sum + s.total, 0) || 0;
    const shiftCount = shift?.sales?.length || 0;
    return NextResponse.json({ shiftSales, shiftCount, hasOpenShift: !!shift });
  }
}

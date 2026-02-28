export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

import { toZonedTime } from "date-fns-tz";
import { getZonedStartOfDay, getZonedEndOfDay } from "@/lib/utils";

export async function GET(req: Request) {
  const start = Date.now();
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const role = (session.user as any).role;
    const isSupervisor = role === "SUPERVISOR" || role === "ADMIN" || role === "GERENTE";
    const userBranchId = (session.user as any).branchId;
    const isAdmin = role === "ADMIN";
    const isGerente = role === "GERENTE";

    const today = getZonedStartOfDay();

    if (isSupervisor) {
      const { searchParams } = new URL(req.url);
      const fBranchId = searchParams.get("branchId");
      const fUserId = searchParams.get("userId");
      const fStart = searchParams.get("startDate");
      const fEnd = searchParams.get("endDate");
      const fMethod = searchParams.get("paymentMethod");

      const whereClause: any = { AND: [] };

      // 1. Branch Filter - Defensive against null/undefined strings
      if (userBranchId && !isGerente && !isAdmin) {
        whereClause.AND.push({ branchId: userBranchId });
      } else if (fBranchId && fBranchId !== "undefined" && fBranchId !== "null" && fBranchId !== "all") {
        whereClause.AND.push({ branchId: fBranchId });
      }

      // 2. User Filter
      if (fUserId && fUserId !== "undefined" && fUserId !== "null" && fUserId !== "all") {
        whereClause.AND.push({ userId: fUserId });
      }

      // 3. Date Filter - Robust parsing
      if (fStart || fEnd) {
        const dateRange: any = {};
        if (fStart && fStart.match(/^\d{4}-\d{2}-\d{2}/)) dateRange.gte = getZonedStartOfDay(fStart);
        if (fEnd && fEnd.match(/^\d{4}-\d{2}-\d{2}/)) dateRange.lte = getZonedEndOfDay(fEnd);
        if (Object.keys(dateRange).length > 0) whereClause.AND.push({ createdAt: dateRange });
      }

      // 4. Method Filter
      if (fMethod && fMethod !== "undefined" && fMethod !== "null" && fMethod !== "all") {
        whereClause.AND.push({ paymentMethod: fMethod });
      }

      const effectiveBranchId = (userBranchId && !isGerente && !isAdmin) ? userBranchId : (fBranchId && fBranchId !== "all" ? fBranchId : undefined);

      // --- ASYNC DATA FETCHING ---
      const [aggFull, aggToday, products, users, distributionSales] = await Promise.all([
        prisma.sale.aggregate({ where: whereClause, _sum: { total: true }, _count: { id: true } }),
        prisma.sale.aggregate({ where: { ...whereClause, AND: [...(whereClause.AND || []), { createdAt: { gte: today } }] }, _sum: { total: true }, _count: { id: true } }),
        prisma.product.count({ where: { active: true, ...(effectiveBranchId ? { OR: [{ branchId: effectiveBranchId }, { stocks: { some: { branchId: effectiveBranchId } } }] } : {}) } }),
        prisma.user.count({ where: { active: true, ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}) } }),
        (prisma as any).sale.findMany({
          where: whereClause,
          select: { total: true, paymentMethod: true, items: { select: { subtotal: true, product: { select: { branchId: true } } } } },
          orderBy: { createdAt: 'desc' },
          take: 400 // Safe limit
        })
      ]);

      const methodStats: Record<string, { total: number, count: number, clearing: number }> = {};
      for (const sale of distributionSales) {
        const saleTotal = Number(sale.total);
        let saleDebt = 0;
        if (effectiveBranchId) {
          for (const item of (sale.items || [])) {
            if (item.product.branchId && item.product.branchId !== effectiveBranchId) {
              saleDebt += Number(item.subtotal);
            }
          }
        }
        const debtRatio = saleTotal > 0 ? saleDebt / saleTotal : 0;
        const m = sale.paymentMethod;
        if (!methodStats[m]) methodStats[m] = { total: 0, count: 0, clearing: 0 };
        methodStats[m].total += saleTotal;
        methodStats[m].count += 1;
        methodStats[m].clearing += (saleTotal * debtRatio);
      }

      const salesByMethod = Object.entries(methodStats).map(([k, v]) => ({
        paymentMethod: k, total: v.total, count: v.count, clearing: v.clearing, net: v.total - v.clearing
      }));

      const elapsed = Date.now() - start;
      console.log(`[Dashboard] Loaded in ${elapsed}ms`);

      return NextResponse.json({
        totalSales: Number(aggFull._sum.total || 0),
        totalCount: aggFull._count.id,
        todaySales: Number(aggToday._sum.total || 0),
        todayCount: aggToday._count.id,
        products, users, salesByMethod,
        lowStockCount: 0, // TEMPORARILY DISABLED
        missingCount: 0,  // TEMPORARILY DISABLED
        isGerente
      });
    } else {
      // Cashier View
      const shift = await prisma.shift.findFirst({ where: { userId: session.user.id, closedAt: null }, include: { sales: true } });
      const shiftSales = shift?.sales?.reduce((sum, s) => sum + Number(s.total), 0) || 0;
      const shiftCount = shift?.sales?.length || 0;
      const methodStats: Record<string, { total: number, count: number }> = {};
      if (shift?.sales) {
        for (const sale of shift.sales) {
          const m = sale.paymentMethod;
          if (!methodStats[m]) methodStats[m] = { total: 0, count: 0 };
          methodStats[m].total += Number(sale.total);
          methodStats[m].count += 1;
        }
      }
      return NextResponse.json({
        shiftSales, shiftCount, hasOpenShift: !!shift,
        salesByMethod: Object.entries(methodStats).map(([k, v]) => ({ paymentMethod: k, total: v.total, count: v.count }))
      });
    }
  } catch (error: any) {
    console.error("[Dashboard] Critical Error:", error);
    return NextResponse.json({
      error: "Critical Server Error",
      message: error.message,
      code: error.code // Prisma error code
    }, { status: 500 });
  }
}

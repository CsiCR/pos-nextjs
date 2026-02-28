export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

import { toZonedTime } from "date-fns-tz";
import { getZonedStartOfDay, getZonedEndOfDay } from "@/lib/utils";

export async function GET(req: Request) {
  const start = Date.now();
  let step = "init";
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
      step = "parsing-params";
      const { searchParams } = new URL(req.url);
      const fBranchId = searchParams.get("branchId");
      const fUserId = searchParams.get("userId");
      const fStart = searchParams.get("startDate");
      const fEnd = searchParams.get("endDate");
      const fMethod = searchParams.get("paymentMethod");

      const whereClause: any = { AND: [] };

      if (userBranchId && !isGerente && !isAdmin) {
        whereClause.AND.push({ branchId: userBranchId });
      } else if (fBranchId && fBranchId !== "undefined" && fBranchId !== "null" && fBranchId !== "all" && fBranchId !== "") {
        whereClause.AND.push({ branchId: fBranchId });
      }

      if (fUserId && fUserId !== "undefined" && fUserId !== "null" && fUserId !== "all" && fUserId !== "") {
        whereClause.AND.push({ userId: fUserId });
      }

      if (fStart || fEnd) {
        const dateRange: any = {};
        if (fStart && fStart.match(/^\d{4}-\d{2}-\d{2}/)) dateRange.gte = getZonedStartOfDay(fStart);
        if (fEnd && fEnd.match(/^\d{4}-\d{2}-\d{2}/)) dateRange.lte = getZonedEndOfDay(fEnd);
        if (Object.keys(dateRange).length > 0) whereClause.AND.push({ createdAt: dateRange });
      }

      if (fMethod && fMethod !== "undefined" && fMethod !== "null" && fMethod !== "all" && fMethod !== "") {
        whereClause.AND.push({ paymentMethod: fMethod });
      }

      const effectiveBranchId = (userBranchId && !isGerente && !isAdmin) ? userBranchId : (fBranchId && fBranchId !== "all" ? fBranchId : undefined);

      step = "query-agg-full";
      const aggFull = await prisma.sale.aggregate({ where: whereClause, _sum: { total: true }, _count: { id: true } });

      step = "query-agg-today";
      const aggToday = await prisma.sale.aggregate({ where: { ...whereClause, AND: [...(whereClause.AND || []), { createdAt: { gte: today } }] }, _sum: { total: true }, _count: { id: true } });

      step = "query-methods";
      const methodGroups = await prisma.sale.groupBy({
        by: ['paymentMethod'],
        where: whereClause,
        _sum: { total: true },
        _count: { id: true }
      });

      step = "query-distribution-clearing";
      const distributionSales = await (prisma as any).sale.findMany({
        where: whereClause,
        select: { total: true, paymentMethod: true, items: { select: { subtotal: true, product: { select: { branchId: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 200
      });

      const methodStats: Record<string, { total: number, count: number, clearing: number }> = {};
      for (const g of methodGroups) {
        methodStats[g.paymentMethod] = { total: Number(g._sum.total || 0), count: g._count.id, clearing: 0 };
      }

      for (const sale of distributionSales) {
        const saleTotal = Number(sale.total);
        let saleDebt = 0;
        if (effectiveBranchId) {
          for (const item of (sale.items || [])) {
            if (item.product?.branchId && item.product.branchId !== effectiveBranchId) {
              saleDebt += Number(item.subtotal || 0);
            }
          }
        }
        const m = sale.paymentMethod;
        if (methodStats[m] && saleTotal > 0) {
          methodStats[m].clearing += (saleDebt);
        }
      }

      const salesByMethod = Object.entries(methodStats).map(([k, v]) => ({
        paymentMethod: k, total: v.total, count: v.count, clearing: v.clearing, net: v.total - v.clearing
      }));

      step = "query-products";
      const products = await prisma.product.count({ where: { active: true, ...(effectiveBranchId ? { OR: [{ branchId: effectiveBranchId }, { stocks: { some: { branchId: effectiveBranchId } } }] } : {}) } });

      step = "query-users";
      const users = await prisma.user.count({ where: { active: true, ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}) } });

      step = "query-stock-alerts";
      let lowStockCount = 0;
      let missingCount = 0;
      const stockProducts = await (prisma as any).product.findMany({
        where: { active: true, ...(effectiveBranchId ? { OR: [{ branchId: effectiveBranchId }, { branchId: null }, { stocks: { some: { branchId: effectiveBranchId } } }] } : {}) },
        select: {
          minStock: true,
          stocks: { select: { quantity: true, branchId: true } }
        },
        take: 1000
      });

      for (const p of stockProducts) {
        const min = Number(p.minStock || 0);
        if (effectiveBranchId) {
          const branchStock = p.stocks?.find((s: any) => s.branchId === effectiveBranchId);
          const qty = branchStock ? Number(branchStock.quantity) : 0;
          if (qty <= 0) missingCount++; else if (qty < min) lowStockCount++;
        } else {
          const totalQty = p.stocks?.reduce((acc: number, s: any) => acc + Number(s.quantity), 0) || 0;
          if (totalQty <= 0) missingCount++; else if (totalQty < min) lowStockCount++;
        }
      }

      const elapsed = Date.now() - start;
      console.log(`[Dashboard v7] OK in ${elapsed}ms`);

      return NextResponse.json({
        totalSales: Number(aggFull._sum.total || 0),
        totalCount: aggFull._count.id,
        todaySales: Number(aggToday._sum.total || 0),
        todayCount: aggToday._count.id,
        products, users, salesByMethod,
        lowStockCount, missingCount,
        isGerente
      });
    } else {
      step = "cashier-view";
      const shift = await prisma.shift.findFirst({ where: { userId: session.user.id, closedAt: null }, include: { sales: true } });
      const shiftSales = shift?.sales?.reduce((sum, s) => sum + Number(s.total), 0) || 0;
      const shiftCount = shift?.sales?.length || 0;
      return NextResponse.json({
        shiftSales, shiftCount, hasOpenShift: !!shift,
        salesByMethod: []
      });
    }
  } catch (error: any) {
    console.error(`[Dashboard v6] Error at ${step}:`, error);
    return NextResponse.json({
      error: `Error en paso [${step}]: ${error.message}`,
      step,
      message: error.message,
      code: error.code
    }, { status: 500 });
  }
}

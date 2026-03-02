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

      step = "query-agg-full-sales";
      const aggFullSales = await prisma.sale.aggregate({ where: whereClause, _sum: { total: true }, _count: { id: true } });

      const paymentWhereClause: any = { AND: [] };
      if (whereClause.AND) {
        whereClause.AND.forEach((c: any) => {
          if (c.userId) {
            paymentWhereClause.AND.push({ shift: { userId: c.userId } });
          }
          if (c.createdAt) {
            paymentWhereClause.AND.push({ createdAt: c.createdAt });
          }
          // Note: If branchId is needed, we can add { shift: { branchId: c.branchId } }
          if (c.branchId) {
            paymentWhereClause.AND.push({ shift: { branchId: c.branchId } });
          }
          if (c.paymentMethod) {
            paymentWhereClause.AND.push({ method: c.paymentMethod });
          }
        });
      }
      const aggFullPayments = await prisma.customerTransaction.aggregate({
        where: { ...paymentWhereClause, type: "PAYMENT" },
        _sum: { amount: true }
      });

      step = "query-agg-today-sales";
      const aggTodaySales = await prisma.sale.aggregate({ where: { ...whereClause, AND: [...(whereClause.AND || []), { createdAt: { gte: today } }] }, _sum: { total: true }, _count: { id: true } });

      step = "query-agg-today-payments";
      const aggTodayPayments = await prisma.customerTransaction.aggregate({
        where: { ...paymentWhereClause, type: "PAYMENT", createdAt: { gte: today } },
        _sum: { amount: true }
      });

      step = "query-methods-groupBy-sales";
      const methodGroupsSales = await prisma.sale.groupBy({
        by: ['paymentMethod'],
        where: whereClause,
        _sum: { total: true },
        _count: { id: true }
      });

      const paymentDetails = await (prisma as any).customerTransactionPaymentDetail.findMany({
        where: {
          customerTransaction: {
            ...paymentWhereClause,
            type: "PAYMENT"
          }
        },
        select: {
          method: true,
          amount: true
        }
      });

      const paymentMethodsMap: Record<string, { total: number, count: number }> = {};
      paymentDetails.forEach((pd: any) => {
        if (!paymentMethodsMap[pd.method]) paymentMethodsMap[pd.method] = { total: 0, count: 0 };
        paymentMethodsMap[pd.method].total += Number(pd.amount);
        // counts are tricky for details, maybe count transactions instead? 
        // For dashboard, total is more important.
      });

      // Also handle transactions that don't have details (legacy or single method if not using details model yet)
      // but based on our previous work, they should have details or we can fallback to the 'method' field in CustomerTransaction
      const singleMethodPayments = await prisma.customerTransaction.findMany({
        where: {
          ...paymentWhereClause,
          type: "PAYMENT",
          method: { not: "MIXTO" }
        } as any,
        select: { method: true, amount: true } as any
      });

      (singleMethodPayments as any[]).forEach(p => {
        if (!paymentMethodsMap[p.method]) paymentMethodsMap[p.method] = { total: 0, count: 0 };
        paymentMethodsMap[p.method].total += Number(p.amount);
        paymentMethodsMap[p.method].count += 1;
      });

      // Merge Sales and Payments
      const finalMethods: Record<string, { total: number, count: number }> = {};

      methodGroupsSales.forEach(g => {
        if (g.paymentMethod === "MIXTO") return; // We'll handle MIXTO details separately if needed, 
        // but current logic uses s.total. Let's stick to sales breakdown if possible.
        finalMethods[g.paymentMethod] = {
          total: Number(g._sum.total || 0),
          count: g._count.id
        };
      });

      // Add payments to finalMethods
      Object.keys(paymentMethodsMap).forEach(m => {
        if (!finalMethods[m]) finalMethods[m] = { total: 0, count: 0 };
        finalMethods[m].total += paymentMethodsMap[m].total;
        finalMethods[m].count += paymentMethodsMap[m].count;
      });

      const salesByMethod = Object.keys(finalMethods).map(m => ({
        paymentMethod: m,
        total: finalMethods[m].total,
        count: finalMethods[m].count,
        clearing: 0,
        net: finalMethods[m].total
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
        select: { minStock: true, stocks: { select: { quantity: true, branchId: true } } },
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
      console.log(`[Dashboard v10] OK in ${elapsed}ms`);

      return NextResponse.json({
        totalSales: Number(aggFullSales._sum.total || 0) + Number(aggFullPayments._sum.amount || 0),
        totalCount: aggFullSales._count.id,
        todaySales: Number(aggTodaySales._sum.total || 0) + Number(aggTodayPayments._sum.amount || 0),
        todayCount: aggTodaySales._count.id,
        products, users, salesByMethod,
        lowStockCount, missingCount,
        isGerente
      });
    } else {
      step = "cashier-view";
      const shift = await (prisma as any).shift.findFirst({
        where: { userId: session.user.id, closedAt: null },
        include: {
          sales: { include: { paymentDetails: true } },
          customerTransactions: { include: { paymentDetails: true } }
        }
      });

      const shiftSales = (shift?.sales?.reduce((sum: number, s: any) => sum + Number(s.total), 0) || 0) +
        (shift?.customerTransactions?.reduce((sum: number, tx: any) => sum + Number(tx.amount), 0) || 0);

      const shiftCount = (shift?.sales?.length || 0) + (shift?.customerTransactions?.length || 0);

      const cashierMethods: Record<string, { total: number, count: number }> = {};

      // Sales methods
      shift?.sales.forEach((s: any) => {
        if (s.paymentMethod === "MIXTO") {
          s.paymentDetails.forEach((pd: any) => {
            if (!cashierMethods[pd.method]) cashierMethods[pd.method] = { total: 0, count: 0 };
            cashierMethods[pd.method].total += Number(pd.amount);
          });
        } else {
          if (!cashierMethods[s.paymentMethod]) cashierMethods[s.paymentMethod] = { total: 0, count: 0 };
          cashierMethods[s.paymentMethod].total += Number(s.total);
          cashierMethods[s.paymentMethod].count += 1;
        }
      });

      // Payment methods
      shift?.customerTransactions.forEach((tx: any) => {
        if (tx.method === "MIXTO") {
          tx.paymentDetails.forEach((pd: any) => {
            if (!cashierMethods[pd.method]) cashierMethods[pd.method] = { total: 0, count: 0 };
            cashierMethods[pd.method].total += Number(pd.amount);
          });
        } else {
          if (!cashierMethods[tx.method]) cashierMethods[tx.method] = { total: 0, count: 0 };
          cashierMethods[tx.method].total += Number(tx.amount);
          cashierMethods[tx.method].count += 1;
        }
      });

      const salesByMethod = Object.keys(cashierMethods).map(m => ({
        paymentMethod: m,
        total: cashierMethods[m].total,
        count: cashierMethods[m].count
      }));

      return NextResponse.json({
        shiftSales, shiftCount, hasOpenShift: !!shift,
        salesByMethod
      });
    }
  } catch (error: any) {
    console.error(`[Dashboard v9] Error at ${step}:`, error);
    return NextResponse.json({
      error: `Error en paso [${step}]: ${error.message}`,
      step,
      message: error.message,
      code: error.code
    }, { status: 500 });
  }
}

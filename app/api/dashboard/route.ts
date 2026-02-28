export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

import { toZonedTime } from "date-fns-tz";
import { getZonedStartOfDay, getZonedEndOfDay } from "@/lib/utils";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const isSupervisor = (session.user as any).role === "SUPERVISOR" || (session.user as any).role === "ADMIN";
  const isGerente = (session.user as any).role === "GERENTE";
  const branchId = (session.user as any).branchId;

  // Fix Timezone for Production (Server is UTC, User is ARG)
  const today = getZonedStartOfDay();

  if (isSupervisor || isGerente) {
    // Analytics for the whole branch or global
    const { searchParams } = new URL(req.url);

    // Filters
    const filterBranchId = searchParams.get("branchId");
    const filterUserId = searchParams.get("userId");
    const filterStartDate = searchParams.get("startDate");
    const filterEndDate = searchParams.get("endDate");
    const filterPaymentMethod = searchParams.get("paymentMethod");

    // Build where clause
    const whereClause: any = { AND: [] };

    const isAdmin = (session.user as any).role === "ADMIN";

    if (branchId && !isGerente && !isAdmin) {
      whereClause.AND.push({ branchId });
    } else if (filterBranchId) {
      whereClause.AND.push({ branchId: filterBranchId });
    }

    if (filterUserId) {
      whereClause.AND.push({ userId: filterUserId });
    }

    if (filterStartDate || filterEndDate) {
      const dateRange: any = {};
      if (filterStartDate) dateRange.gte = getZonedStartOfDay(filterStartDate);
      if (filterEndDate) dateRange.lte = getZonedEndOfDay(filterEndDate);
      whereClause.AND.push({ createdAt: dateRange });
    }

    if (filterPaymentMethod) {
      whereClause.AND.push({
        OR: [
          { paymentMethod: filterPaymentMethod },
          { paymentDetails: { some: { method: filterPaymentMethod } } }
        ]
      });
    }

    const effectiveBranchId = (branchId && !isGerente && !isAdmin) ? branchId : filterBranchId;

    // Data Aggregation
    let totalSales = 0;
    let totalCount = 0;
    let todaySales = 0;
    let todayCount = 0;

    // We will build salesByMethod with detailed breakdown
    const methodStats: Record<string, { total: number, count: number, clearing: number }> = {};

    // 1. Totals and Counts using Aggregate (Fast)
    const aggregateSales = await prisma.sale.aggregate({
      where: whereClause,
      _sum: { total: true },
      _count: { id: true }
    });
    totalSales = Number(aggregateSales._sum.total || 0);
    totalCount = aggregateSales._count.id;

    const todayWhere = { ...whereClause, AND: [...(whereClause.AND || []), { createdAt: { gte: today } }] };
    const todayAggregate = await prisma.sale.aggregate({
      where: todayWhere,
      _sum: { total: true },
      _count: { id: true }
    });
    todaySales = Number(todayAggregate._sum.total || 0);
    todayCount = todayAggregate._count.id;

    // 2. Detailed Distribution - Only for RECENT/LIMITED sales to avoid production hang
    // Note: If user wants full history detail, this needs a much more efficient approach (DB views or background jobs)
    const distributionSales = await (prisma as any).sale.findMany({
      where: whereClause,
      include: {
        paymentDetails: true,
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 1000 // Limit to avoid hang
    });

    for (const sale of distributionSales) {
      const saleTotal = Number(sale.total);

      // Clearing and Method logic remains similar but on LIMITED data
      let saleDebt = 0;
      if (effectiveBranchId) {
        for (const item of (sale.items || [])) {
          if (item.product.branchId && item.product.branchId !== effectiveBranchId) {
            saleDebt += Number(item.subtotal);
          }
        }
      }
      const debtRatio = saleTotal > 0 ? saleDebt / saleTotal : 0;

      const countedMethods = new Set<string>();
      if (sale.paymentDetails && sale.paymentDetails.length > 0) {
        for (const pd of sale.paymentDetails) {
          const m = pd.method;
          const amount = Number(pd.amount);
          const clearingPart = amount * debtRatio;

          if (!methodStats[m]) methodStats[m] = { total: 0, count: 0, clearing: 0 };
          methodStats[m].total += amount;
          if (!countedMethods.has(m)) {
            methodStats[m].count += 1; countedMethods.add(m);
          }
          methodStats[m].clearing += clearingPart;
        }
      } else {
        const m = sale.paymentMethod;
        const amount = saleTotal;
        const clearingPart = amount * debtRatio;
        if (!methodStats[m]) methodStats[m] = { total: 0, count: 0, clearing: 0 };
        methodStats[m].total += amount;
        methodStats[m].count += 1;
        methodStats[m].clearing += clearingPart;
      }
    }

    const salesByMethod = Object.entries(methodStats).map(([k, v]) => ({
      paymentMethod: k,
      total: v.total,
      count: v.count,
      clearing: v.clearing,
      net: v.total - v.clearing
    }));

    // 4. Products Count (Sync with catalog 'onlyMyBranch' logic)
    const productWhere: any = { active: true };
    if (effectiveBranchId) {
      // Unify logic with catalog: branch-exclusive OR global with stock in branch
      productWhere.OR = [
        { branchId: effectiveBranchId },
        { stocks: { some: { branchId: effectiveBranchId } } }
      ];
    }
    const products = await prisma.product.count({ where: productWhere });

    // 5. Users Count (User Scope)
    const userWhere: any = { active: true };
    if (effectiveBranchId) {
      // Show team members of this branch
      userWhere.branchId = effectiveBranchId;
    }
    const users = await prisma.user.count({ where: userWhere });

    // 6. Low Stock Alerts (Logic should match with Catalog for consistency)
    const stockProductWhere: any = { active: true };
    if (effectiveBranchId) {
      // Unify logic with catalog: Show products owned by branch OR Global products (so we can see their 0 stock alert)
      stockProductWhere.OR = [
        { branchId: effectiveBranchId },
        { branchId: null },
        { stocks: { some: { branchId: effectiveBranchId } } }
      ];
    }

    const stockProducts = await (prisma as any).product.findMany({
      where: stockProductWhere,
      select: {
        id: true,
        minStock: true,
        stocks: {
          include: { branch: true }
        }
      }
    });

    let lowStockCount = 0;
    let missingCount = 0;

    for (const p of stockProducts) {
      if (effectiveBranchId) {
        // Branch specific: currentQuantity < currentMinStock
        const branchStock = (p as any).stocks?.find((s: any) => s.branchId === effectiveBranchId);
        const qty = branchStock ? Number(branchStock.quantity) : 0;
        const min = branchStock ? Number(branchStock.minStock || 0) : Number((p as any).minStock || 0);

        if (qty <= 0) missingCount++;
        else if (qty < min) lowStockCount++;
      } else {
        // Global: Sum(qty) < Sum(min)
        const totalQty = (p as any).stocks?.reduce((acc: number, s: any) => acc + Number(s.quantity), 0) || 0;
        const totalMin = (p as any).stocks?.reduce((acc: number, s: any) => acc + Number(s.minStock || 0), 0) || Number((p as any).minStock || 0);

        if (totalQty <= 0) missingCount++;
        else if (totalQty < totalMin) lowStockCount++;
      }
    }

    return NextResponse.json({
      totalSales,
      totalCount,
      todaySales,
      todayCount,
      products,
      users,
      salesByMethod,
      lowStockCount,
      missingCount,
      isGerente
    });
  } else {
    // Cashier view
    const shift = await prisma.shift.findFirst({
      where: { userId: session.user.id, closedAt: null },
      include: { sales: { include: { paymentDetails: true } } }
    });

    const shiftSales = shift?.sales?.reduce((sum, s) => sum + Number(s.total), 0) || 0;
    const shiftCount = shift?.sales?.length || 0;

    // Calculate Sales by Method for Shift
    const methodStats: Record<string, { total: number, count: number }> = {};
    if (shift?.sales) {
      for (const sale of shift.sales) {
        const countedMethods = new Set<string>();
        if (sale.paymentDetails && sale.paymentDetails.length > 0) {
          for (const pd of sale.paymentDetails) {
            const m = pd.method;
            if (!methodStats[m]) methodStats[m] = { total: 0, count: 0 };
            methodStats[m].total += Number(pd.amount);
            if (!countedMethods.has(m)) {
              methodStats[m].count += 1;
              countedMethods.add(m);
            }
          }
        } else {
          const m = sale.paymentMethod;
          if (!methodStats[m]) methodStats[m] = { total: 0, count: 0 };
          methodStats[m].total += Number(sale.total);
          methodStats[m].count += 1;
        }
      }
    }

    const salesByMethod = Object.entries(methodStats).map(([k, v]) => ({
      paymentMethod: k,
      total: v.total,
      count: v.count
    }));

    return NextResponse.json({ shiftSales, shiftCount, hasOpenShift: !!shift, salesByMethod });
  }
}

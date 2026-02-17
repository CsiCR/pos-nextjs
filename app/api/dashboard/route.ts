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
    const whereClause: any = {};

    if (branchId && !isGerente && !isSupervisor /* Admin is also supervisor in logic but we want global */) {
      // Wait, logic check:
      // const isSupervisor = role === SUPERVISOR || role === ADMIN
      // If Role is ADMIN, isSupervisor is true.
      // We want ADMIN to see GLOBAL.
      // Current logic: if (branchId && !isGerente) -> filter by branch.
      // We need: if (branchId && !isGerente && role !== 'ADMIN') -> filter by branch.
    }

    // 40. Correct logic implementation:
    const isAdmin = (session.user as any).role === "ADMIN";

    // SCOPING RULES
    // Supervisor: MUST see only their branch data.
    // Gerente (Manager): Can see ALL, or filter by specific branch.
    // Admin: Can see ALL, or filter by specific branch.

    if (branchId && !isGerente && !isAdmin) {
      // Supervisors (non-admin/non-gerente) bound to their branch
      whereClause.branchId = branchId;
    } else if (filterBranchId) {
      // Gerente OR Admin can filter by specific branch
      whereClause.branchId = filterBranchId;
    }

    if (filterUserId) {
      whereClause.userId = filterUserId;
    }

    if (filterStartDate || filterEndDate) {
      whereClause.createdAt = {};
      if (filterStartDate) whereClause.createdAt.gte = getZonedStartOfDay(filterStartDate);
      if (filterEndDate) whereClause.createdAt.lte = getZonedEndOfDay(filterEndDate);
    }

    if (filterPaymentMethod) {
      whereClause.paymentMethod = filterPaymentMethod;
    }

    const effectiveBranchId = whereClause.branchId;

    // Data Aggregation
    let totalSales = 0;
    let totalCount = 0;
    let todaySales = 0;
    let todayCount = 0;

    // We will build salesByMethod with detailed breakdown
    const methodStats: Record<string, { total: number, count: number, clearing: number }> = {};

    // Fetch Sales with Items for Clearing Calculation
    const allSales = await (prisma as any).sale.findMany({
      where: whereClause,
      include: {
        paymentDetails: true,
        items: { include: { product: true } } // Needed to check ownership
      }
    });

    for (const sale of allSales) {
      const saleTotal = Number(sale.total);
      // Allow negative totals for Refunds
      // if (saleTotal <= 0) continue;

      totalSales += saleTotal;
      totalCount++;

      if (new Date(sale.createdAt) >= today) {
        todaySales += saleTotal;
        todayCount++;
      }

      // --- CLEARING CALCULATION ---
      // Determine how much of this sale belongs to OTHER branches (Debt)
      let saleDebt = 0;
      // Only if we are viewing a specific branch context (otherwise "Global" clearing is meaningless or matrix-like)
      if (effectiveBranchId) {
        for (const item of (sale.items || [])) {
          if (item.product.branchId && item.product.branchId !== effectiveBranchId) {
            saleDebt += Number(item.subtotal);
          }
        }
      }

      const debtRatio = saleDebt / saleTotal;

      // --- METHOD DISTRIBUTION ---
      // Distribute Total and Clearing Debt across methods
      if (sale.paymentDetails && sale.paymentDetails.length > 0) {
        for (const pd of sale.paymentDetails) {
          const m = pd.method;
          const amount = Number(pd.amount);
          const clearingPart = amount * debtRatio;

          if (!methodStats[m]) methodStats[m] = { total: 0, count: 0, clearing: 0 };
          methodStats[m].total += amount;
          methodStats[m].count += 1;
          methodStats[m].clearing += clearingPart;
        }
      } else {
        // Fallback single method
        const m = sale.paymentMethod;
        const amount = saleTotal;
        const clearingPart = amount * debtRatio; // == saleDebt

        if (!methodStats[m]) methodStats[m] = { total: 0, count: 0, clearing: 0 };
        methodStats[m].total += amount;
        methodStats[m].count += 1;
        methodStats[m].clearing += clearingPart;
      }
    }

    const salesByMethod = Object.entries(methodStats).map(([k, v]) => ({
      paymentMethod: k,
      total: v.total, // Total collected
      count: v.count,
      clearing: v.clearing, // Amount owned by others
      net: v.total - v.clearing // Amount owned by this branch
    }));

    // 4. Products Count (User Scope - STRICT OWNERSHIP)
    // "Active products also calculated for logged user"
    const productWhere: any = { active: true };
    if (effectiveBranchId && !isAdmin && !isGerente) {
      // Supervisor: Count both their branch and global products
      productWhere.OR = [{ branchId: effectiveBranchId }, { branchId: null }];
    } else if (effectiveBranchId) {
      productWhere.branchId = effectiveBranchId;
    }
    const products = await prisma.product.count({ where: productWhere });

    // 5. Users Count (User Scope)
    const userWhere: any = { active: true };
    if (effectiveBranchId) {
      // Show team members of this branch
      userWhere.branchId = effectiveBranchId;
    }
    const users = await prisma.user.count({ where: userWhere });

    // 6. Low Stock Alerts (Supervisor Owner Context)
    let lowStockCount = 0;
    if (effectiveBranchId) {
      lowStockCount = await (prisma as any).stock.count({
        where: {
          branchId: effectiveBranchId,
          quantity: { lte: 0 },
          product: { active: true }
        }
      });
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
        if (sale.paymentDetails && sale.paymentDetails.length > 0) {
          for (const pd of sale.paymentDetails) {
            const m = pd.method;
            if (!methodStats[m]) methodStats[m] = { total: 0, count: 0 };
            methodStats[m].total += Number(pd.amount);
            methodStats[m].count += 1;
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

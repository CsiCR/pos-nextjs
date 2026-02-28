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

      step = "query-products";
      const products = await prisma.product.count({ where: { active: true, ...(effectiveBranchId ? { OR: [{ branchId: effectiveBranchId }, { stocks: { some: { branchId: effectiveBranchId } } }] } : {}) } });

      step = "query-users";
      const users = await prisma.user.count({ where: { active: true, ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}) } });

      // step = "query-distribution";
      const salesByMethod: any[] = [];

      const elapsed = Date.now() - start;
      console.log(`[Dashboard v6] OK in ${elapsed}ms`);

      return NextResponse.json({
        totalSales: Number(aggFull._sum.total || 0),
        totalCount: aggFull._count.id,
        todaySales: Number(aggToday._sum.total || 0),
        todayCount: aggToday._count.id,
        products, users, salesByMethod,
        lowStockCount: 0,
        missingCount: 0,
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

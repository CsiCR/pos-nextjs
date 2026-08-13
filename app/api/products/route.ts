export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";

    const page = Number(searchParams.get("page")) || 1;
    const pageSize = Number(searchParams.get("pageSize")) || 100;

    const userRole = (session?.user as any)?.role;
    const branchId = (session?.user as any)?.branchId;
    const allStocks = searchParams.get("allStocks") === "true";
    const onlyMyBranch = searchParams.get("onlyMyBranch") === "true";

    const activeShift = await prisma.shift.findFirst({
      where: { userId: session?.user?.id, closedAt: null },
      select: { branchId: true }
    });

    const effectiveBranchId = activeShift?.branchId || branchId;
    const isRestrictedRole = userRole === "SUPERVISOR" || userRole === "CAJERO";
    const explicitBranchId = searchParams.get("branchId");

    let contextBranchId = explicitBranchId || null;
    if (!explicitBranchId && (isRestrictedRole || onlyMyBranch)) {
      contextBranchId = effectiveBranchId || null;
    }

    const filterBranchId = explicitBranchId || (allStocks ? null : contextBranchId);

    const includeOptions = {
      category: true,
      baseUnit: true,
      branch: true,
      prices: { include: { priceList: true } },
      stocks: {
        where: allStocks ? undefined : (filterBranchId ? { branchId: filterBranchId } : undefined),
        include: { branch: true }
      }
    };

    const exactMatch = await (prisma as any).product.findFirst({
      where: { active: true, OR: [{ code: search }, { ean: search }] },
      include: includeOptions
    });

    if (exactMatch && search.length > 2) {
      if (userRole === "SUPERVISOR") {
        const isGlobal = !exactMatch.branchId;
        const isMine = exactMatch.branchId === branchId;
        if (!isGlobal && !isMine) return NextResponse.json([]);
      }
      if ((userRole === "ADMIN" || userRole === "GERENTE") && !filterBranchId) {
        (exactMatch as any).displayStock = exactMatch.stocks?.reduce((acc: number, s: any) => acc + Number(s.quantity), 0) || 0;
      }
      return NextResponse.json({ products: [exactMatch], total: 1, page: 1, pageSize, totalPages: 1 });
    }

    const filterMode = searchParams.get("filterMode") || "all";
    const andConditions: any[] = filterMode === "inactive" ? [{ active: false }] : [{ active: true }];

    if (search) {
      andConditions.push({
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
          { ean: { contains: search, mode: "insensitive" } }
        ]
      });
    }

    if (onlyMyBranch && effectiveBranchId) {
      andConditions.push({
        OR: [
          { branchId: effectiveBranchId },
          { stocks: { some: { branchId: effectiveBranchId } } }
        ]
      });
    } else if (userRole === "SUPERVISOR" || (userRole === "CAJERO" && !allStocks)) {
      const targetBranchId = userRole === "SUPERVISOR" ? branchId : (activeShift?.branchId || branchId);
      andConditions.push(targetBranchId ? { OR: [{ branchId: null }, { branchId: targetBranchId }] } : { branchId: null });
    }

    const whereClause: any = { AND: andConditions };
    const categoryId = searchParams.get("categoryId");
    if (categoryId) whereClause.categoryId = categoryId;

    const isFiltered = filterMode !== "all";
    const [products, total] = await Promise.all([
      (prisma as any).product.findMany({
        where: whereClause,
        include: includeOptions,
        orderBy: { name: "asc" },
        ...(isFiltered ? {} : { skip: (page - 1) * pageSize, take: pageSize })
      }),
      (prisma as any).product.count({ where: whereClause })
    ]);

    const mappedProducts = products.map((p: any) => {
      if (!filterBranchId) {
        p.displayStock = p.stocks?.reduce((acc: number, s: any) => acc + Number(s.quantity), 0) || 0;
        p.displayMinStock = p.stocks?.reduce((acc: number, s: any) => acc + Number(s.minStock || 0), 0) || Number(p.minStock || 0);
      } else {
        const branchStock = p.stocks?.find((s: any) => s.branchId === filterBranchId);
        p.displayStock = branchStock ? Number(branchStock.quantity) : 0;
        p.displayMinStock = branchStock ? Number(branchStock.minStock || 0) : Number(p.minStock || 0);
      }

      if (contextBranchId) {
        const branchPrice = p.prices?.find((pr: any) => pr.priceList?.branchId === contextBranchId);
        p.displayPrice = branchPrice ? Number(branchPrice.price) : Number(p.basePrice);
      } else {
        p.displayPrice = Number(p.basePrice);
      }

      p.priceLower = p.displayPrice < Number(p.basePrice);
      p.priceHigher = p.displayPrice > Number(p.basePrice);
      p.priceAlert = p.priceLower;

      let includeProduct = true;
      if (filterMode === "low_stock") includeProduct = p.displayStock > 0 && p.displayStock < p.displayMinStock;
      else if (filterMode === "missing" || filterMode === "critical") includeProduct = p.displayStock <= 0;
      else if (filterMode === "transfer") {
        const hasCriticalBranch = p.stocks?.some((s: any) => {
          const branchMin = Number(s.minStock || 0) || Number(p.minStock || 0);
          return Number(s.quantity) <= 0 || Number(s.quantity) < branchMin;
        });
        includeProduct = p.displayStock > 5 && hasCriticalBranch;
      } else if (filterMode === "price_mismatch") includeProduct = Math.round(Number(p.displayPrice)) !== Math.round(Number(p.basePrice));
      else if (filterMode === "withStock") includeProduct = p.displayStock > 0;

      return includeProduct ? p : null;
    }).filter(Boolean);

    let finalProducts = mappedProducts;
    let effectiveTotal = total;
    if (isFiltered) {
      effectiveTotal = mappedProducts.length;
      finalProducts = mappedProducts.slice((page - 1) * pageSize, page * pageSize);
    }

    return NextResponse.json({ products: finalProducts, total: effectiveTotal, page, pageSize, totalPages: Math.ceil(effectiveTotal / pageSize) });
  } catch (error: any) {
    console.error("GET Products Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    if (!session || !["SUPERVISOR", "ADMIN", "GERENTE"].includes(userRole)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const data = await req.json();
    const code = data.code || `INT${Date.now()}`;
    const userBranchId = (session.user as any).branchId;

    let stockRows: any[] = [];
    if (userRole === "SUPERVISOR") {
      if (!userBranchId) return NextResponse.json({ error: "El supervisor no tiene una sucursal asignada" }, { status: 403 });
      const requestedOwnStock = Array.isArray(data.branchStocks)
        ? data.branchStocks.find((s: any) => s.branchId === userBranchId)
        : null;
      stockRows = [{
        branchId: userBranchId,
        quantity: Number(requestedOwnStock?.quantity ?? data.stock) || 0,
        minStock: Number(requestedOwnStock?.minStock ?? data.minStock) || 0
      }];
    } else if (Array.isArray(data.branchStocks) && data.branchStocks.length > 0) {
      stockRows = data.branchStocks.map((s: any) => ({
        branchId: s.branchId,
        quantity: Number(s.quantity) || 0,
        minStock: Number(s.minStock) || 0
      }));
    } else if (userBranchId) {
      stockRows = [{ branchId: userBranchId, quantity: Number(data.stock) || 0, minStock: Number(data.minStock) || 0 }];
    }

    let allowedPrices = Array.isArray(data.prices) ? data.prices : [];
    if (userRole === "SUPERVISOR") {
      const ids = allowedPrices.map((p: any) => p.priceListId).filter(Boolean);
      if (ids.length) {
        const lists = await (prisma as any).priceList.findMany({ where: { id: { in: ids } }, select: { id: true, branchId: true } });
        const allowedIds = new Set(lists.filter((l: any) => l.branchId === userBranchId).map((l: any) => l.id));
        allowedPrices = allowedPrices.filter((p: any) => allowedIds.has(p.priceListId));
      }
    }

    const product = await (prisma as any).product.create({
      data: {
        code,
        ean: data.ean || null,
        name: data.name,
        basePrice: Number(data.basePrice || data.price || 0),
        baseUnit: data.baseUnitId ? { connect: { id: data.baseUnitId } } : undefined,
        category: data.categoryId ? { connect: { id: data.categoryId } } : undefined,
        minStock: Number(data.minStock || 0),
        active: data.active !== undefined ? Boolean(data.active) : true,
        branch: undefined,
        stocks: stockRows.length ? { create: stockRows } : undefined,
        prices: allowedPrices.length ? {
          create: allowedPrices.map((p: any) => ({ priceListId: p.priceListId, price: Number(p.price) }))
        } : undefined
      }
    });

    return NextResponse.json(product);
  } catch (error: any) {
    console.error("POST Product Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

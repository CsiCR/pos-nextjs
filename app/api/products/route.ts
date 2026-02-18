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
    const withStockOnly = searchParams.get("withStockOnly") === "true";

    // Pagination params
    const page = Number(searchParams.get("page")) || 1;
    const pageSize = Number(searchParams.get("pageSize")) || 100;

    const userRole = (session?.user as any)?.role;
    const branchId = (session?.user as any)?.branchId;
    const allStocks = searchParams.get("allStocks") === "true";

    // [NEW] Shift dynamic branch awareness
    const activeShift = await prisma.shift.findFirst({
      where: { userId: session?.user?.id, closedAt: null },
      select: { branchId: true }
    });

    // Context branch for PRICES (always prioritized if available)
    const contextBranchId = searchParams.get("branchId") || activeShift?.branchId || (userRole === "SUPERVISOR" ? branchId : null);

    // If allStocks=true (Global Search), we don't force the branch filter for stock calculation/visibility
    // but we prioritize context for PRICES.
    const filterBranchId = searchParams.get("branchId") || (allStocks ? null : contextBranchId);

    const includeOptions = {
      category: true,
      baseUnit: true,
      branch: true,
      prices: {
        include: {
          priceList: true
        }
      },
      stocks: {
        where: allStocks ? undefined : (filterBranchId ? { branchId: filterBranchId } : undefined),
        include: { branch: true }
      }
    };

    // 1. Exact Match Priority
    const exactMatch = await (prisma as any).product.findFirst({
      where: {
        active: true,
        OR: [{ code: search }, { ean: search }]
      },
      include: includeOptions
    });

    if (exactMatch && search.length > 2) {
      // Check visibility for exact match
      if (userRole === "SUPERVISOR") {
        const isGlobal = !exactMatch.branchId;
        const isMine = exactMatch.branchId === branchId;
        if (!isGlobal && !isMine) return NextResponse.json([]); // Hidden if not yours
      }
      // Calculate display stock for Gerentes if no branch filtered
      if ((userRole === "ADMIN" || userRole === "GERENTE") && !filterBranchId) {
        (exactMatch as any).displayStock = exactMatch.stocks?.reduce((acc: number, s: any) => acc + Number(s.quantity), 0) || 0;
      }
      return NextResponse.json([exactMatch]);
    }

    // 2. Build Query
    const showInactive = searchParams.get("showInactive") === "true";
    const andConditions: any[] = showInactive ? [] : [{ active: true }];

    // Search
    if (search) {
      andConditions.push({
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
          { ean: { contains: search, mode: "insensitive" } }
        ]
      });
    }

    // Ownership Logic
    if (userRole === "SUPERVISOR" || (userRole === "CAJERO" && !allStocks)) {
      const targetBranchId = userRole === "SUPERVISOR" ? branchId : (activeShift?.branchId || branchId);
      if (targetBranchId) {
        andConditions.push({
          OR: [{ branchId: null }, { branchId: targetBranchId }]
        });
      } else {
        andConditions.push({ branchId: null });
      }
    }

    const whereClause: any = { AND: andConditions };

    // Filter Logic
    const filterMode = searchParams.get("filterMode") || "all";

    // Defer complex multi-branch filters to JS processing
    // because Prisma cannot easily aggregate across branches in a findMany where.

    // Category Filter
    const categoryId = searchParams.get("categoryId");
    if (categoryId) {
      whereClause.categoryId = categoryId;
    }

    const [products, total] = await Promise.all([
      (prisma as any).product.findMany({
        where: whereClause,
        include: includeOptions,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      (prisma as any).product.count({ where: whereClause })
    ]);

    // Handle displayStock, displayMinStock and priceAlert calculation
    const mappedProducts = products.map((p: any) => {
      // 1. Stock & MinStock Calculation
      if (!filterBranchId) {
        // Global Stock & MinStock Sum
        p.displayStock = p.stocks?.reduce((acc: number, s: any) => acc + Number(s.quantity), 0) || 0;
        p.displayMinStock = p.stocks?.reduce((acc: number, s: any) => acc + Number(s.minStock || 0), 0) || Number(p.minStock || 0);
      } else {
        // Branch Specific Stock & MinStock
        const branchStock = p.stocks?.find((s: any) => s.branchId === filterBranchId);
        p.displayStock = branchStock ? Number(branchStock.quantity) : 0;
        p.displayMinStock = branchStock ? Number(branchStock.minStock || 0) : Number(p.minStock || 0);
      }

      // 2. Price Calculation (Branch Priority)
      if (contextBranchId) {
        const branchPrice = p.prices?.find((pr: any) => pr.priceList?.branchId === contextBranchId);
        p.displayPrice = branchPrice ? Number(branchPrice.price) : Number(p.basePrice);
      } else {
        p.displayPrice = Number(p.basePrice);
      }

      // 3. Price Alert Logic (Expert: Price < BasePrice)
      p.priceAlert = p.displayPrice < Number(p.basePrice);

      // 4. Inventory Filtering Decision
      let includeProduct = true;
      if (filterMode === "low_stock") {
        includeProduct = p.displayStock < p.displayMinStock;
      } else if (filterMode === "missing") {
        includeProduct = p.displayStock <= 0;
      } else if (filterMode === "transfer") {
        const hasCriticalBranch = p.stocks?.some((s: any) => {
          const branchMin = Number(s.minStock || 0) || Number(p.minStock || 0);
          return Number(s.quantity) <= 0 || Number(s.quantity) < branchMin;
        });
        includeProduct = p.displayStock > 5 && hasCriticalBranch;
      } else if (filterMode === "withStock") {
        includeProduct = p.displayStock > 0;
      } else if (filterMode === "critical") {
        // Legacy support/alias for missing
        includeProduct = p.displayStock <= 0;
      }

      return includeProduct ? p : null;
    }).filter(Boolean);

    // If we filtered in memory, total might have changed
    const effectiveTotal = (filterMode !== "all") ? mappedProducts.length : total;

    return NextResponse.json({
      products: mappedProducts,
      total: effectiveTotal,
      page,
      pageSize,
      totalPages: Math.ceil(effectiveTotal / pageSize)
    });
  } catch (error: any) {
    console.error("GET Products Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    if (!session || (userRole !== "SUPERVISOR" && userRole !== "ADMIN" && userRole !== "GERENTE")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const data = await req.json();
    const code = data.code || `INT${Date.now()}`;
    const branchId = (session.user as any).branchId;

    // Ownership Assignment:
    // Every new product is now Global (null) so everyone can see it and manage their own stock.
    const ownerBranchId = null;

    const product = await (prisma as any).product.create({
      data: {
        code,
        ean: data.ean || null,
        name: data.name,
        basePrice: data.basePrice || data.price || 0,
        baseUnit: data.baseUnitId ? { connect: { id: data.baseUnitId } } : undefined,
        category: data.categoryId ? { connect: { id: data.categoryId } } : undefined,
        minStock: data.minStock || 0,
        active: data.active !== undefined ? Boolean(data.active) : true,
        branch: undefined, // No owner branch = Global
        stocks: branchId ? { // Initialize stock entry ONLY for the creator's branch
          create: {
            branchId,
            quantity: data.stock || 0,
            minStock: data.minStock || 0
          }
        } : undefined,
        prices: data.prices && Array.isArray(data.prices) ? {
          create: data.prices.map((p: any) => ({
            priceListId: p.priceListId,
            price: Number(p.price)
          }))
        } : undefined
      }
    });

    return NextResponse.json(product);
  } catch (error: any) {
    console.error("POST Product Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

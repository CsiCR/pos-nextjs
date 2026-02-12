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

    const userRole = (session?.user as any)?.role;
    const branchId = (session?.user as any)?.branchId;
    const allStocks = searchParams.get("allStocks") === "true";

    // [NEW] Shift dynamic branch awareness
    const activeShift = await prisma.shift.findFirst({
      where: { userId: session?.user?.id, closedAt: null },
      select: { branchId: true }
    });

    // If allStocks=true (Global Search), we don't force the branch filter for stock calculation/visibility
    // but we prioritize: 1. URL branchId, 2. (if not globalSearch) active shift/default branch
    const filterBranchId = searchParams.get("branchId") || (allStocks ? null : (activeShift?.branchId || (userRole === "SUPERVISOR" ? branchId : null)));

    const includeOptions = {
      category: true,
      baseUnit: true,
      branch: true,
      prices: true,
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
    const andConditions: any[] = [{ active: true }];

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
    const stockCondition = filterBranchId ? { branchId: filterBranchId, quantity: { gt: 0 } } : { quantity: { gt: 0 } };

    if (filterMode === "withStock") {
      whereClause.stocks = {
        some: stockCondition
      };
    } else if (filterMode === "missing") {
      // Handled by JS
    } else if (filterMode === "critical") {
      whereClause.stocks = {
        some: {
          branchId: filterBranchId || undefined,
          quantity: { lte: 0 }
        }
      };
    }

    // Category Filter
    const categoryId = searchParams.get("categoryId");
    if (categoryId) {
      whereClause.categoryId = categoryId;
    }

    const products = await (prisma as any).product.findMany({
      where: whereClause,
      include: includeOptions,
      orderBy: { name: "asc" },
      take: 500
    });

    // Handle displayStock calculation for Managers viewing global or specific branch
    const mappedProducts = products.map((p: any) => {
      if (!filterBranchId) {
        // Global Stock Sum
        p.displayStock = p.stocks?.reduce((acc: number, s: any) => acc + Number(s.quantity), 0) || 0;
      } else {
        // Branch Specific Stock
        const branchStock = p.stocks?.find((s: any) => s.branchId === filterBranchId);
        p.displayStock = branchStock ? Number(branchStock.quantity) : 0;
      }
      return p;
    });

    // 4. Post-filtering for "Stock Bajo" (JS needed for field comparison)
    if (filterMode === "missing") {
      const filtered = mappedProducts.filter((p: any) => {
        const currentStock = Number(p.displayStock);
        const minStock = Number(p.minStock || 0);
        return currentStock <= minStock;
      });
      return NextResponse.json(filtered);
    }

    return NextResponse.json(mappedProducts);
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
        branch: undefined, // No owner branch = Global
        stocks: branchId ? { // Initialize stock entry ONLY for the creator's branch
          create: {
            branchId,
            quantity: data.stock || 0
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

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

    const includeOptions = {
      category: true,
      baseUnit: true,
      prices: true,
      stocks: {
        where: allStocks ? undefined : { branchId: branchId || undefined }
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
    // Supervisor: See Global + My Branch
    // Gerente/Admin: See ALL (no constraint added)
    if (userRole === "SUPERVISOR") {
      if (branchId) {
        andConditions.push({
          OR: [{ branchId: null }, { branchId: branchId }]
        });
      } else {
        // Fallback for supervisor without branch (shouldn't happen)
        andConditions.push({ branchId: null });
      }
    }

    const whereClause: any = { AND: andConditions };

    // Filter Logic
    // filterMode: "all" | "missing" | "withStock"
    const filterMode = searchParams.get("filterMode") || "all";

    console.log("DEBUG FILTERS:", { filterMode, branchId, role: userRole });

    const stockCondition = branchId ? { branchId, quantity: { gt: 0 } } : { quantity: { gt: 0 } };

    if (filterMode === "withStock") {
      whereClause.stocks = {
        some: stockCondition
      };
    } else if (filterMode === "missing") {
      // Missing = Not currently having positive stock (in context)
      whereClause.stocks = {
        none: stockCondition
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
      take: 20
    });

    return NextResponse.json(products);
  } catch (error: any) {
    console.error("GET Products Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    if (!session || (userRole !== "SUPERVISOR" && userRole !== "ADMIN")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const data = await req.json();
    const code = data.code || `INT${Date.now()}`;
    const branchId = (session.user as any).branchId;

    // Ownership Assignment:
    // Supervisor -> Assigned to their branch.
    // Admin -> Global (null) by default.
    const ownerBranchId = userRole === "SUPERVISOR" ? branchId : null;

    const product = await (prisma as any).product.create({
      data: {
        code,
        ean: data.ean || null,
        name: data.name,
        basePrice: data.basePrice || data.price || 0,
        baseUnit: data.baseUnitId ? { connect: { id: data.baseUnitId } } : undefined,
        category: data.categoryId ? { connect: { id: data.categoryId } } : undefined,
        minStock: data.minStock || 0, // Add minStock
        branch: ownerBranchId ? { connect: { id: ownerBranchId } } : undefined, // Set Ownership using relation
        stocks: branchId ? { // Initialize stock entry if creator has a branch
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

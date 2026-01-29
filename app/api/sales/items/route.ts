export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search"); // General search
    const productName = searchParams.get("productName");
    const ticketNumber = searchParams.get("ticketNumber");
    const branchName = searchParams.get("branchName");
    const sellerName = searchParams.get("sellerName");
    const paymentMethod = searchParams.get("paymentMethod");
    const branchId = searchParams.get("branchId");
    const userId = searchParams.get("userId");
    const sort = searchParams.get("sort") || "date_desc";

    const userRole = (session.user as any).role;
    const userBranchId = (session.user as any).branchId;
    const isAdmin = userRole === "ADMIN";
    const isGerente = userRole === "GERENTE";

    // Build constraints
    const itemWhere: any = {};
    const saleWhere: any = {};

    // 1. Scoping
    if (userRole === "SUPERVISOR" && !isAdmin) {
        // Supervisor sees only items owned by their branch
        if (userBranchId) {
            itemWhere.product = { branchId: userBranchId };
        }
    } else if (userRole === "CAJERO") {
        // Cashier sees only their own sales
        saleWhere.userId = session.user.id;
    }
    // Gerente/Admin can filter by branch manually
    if ((isGerente || isAdmin) && branchId) {
        itemWhere.product = { branchId };
    }

    // 2. Filters
    if (startDate || endDate) {
        saleWhere.createdAt = {};
        if (startDate) saleWhere.createdAt.gte = new Date(`${startDate}T00:00:00.000Z`);
        if (endDate) saleWhere.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    if (userId) saleWhere.userId = userId;
    if (paymentMethod) {
        saleWhere.OR = [
            { paymentMethod: paymentMethod },
            { paymentDetails: { some: { method: paymentMethod } } }
        ];
    }
    if (ticketNumber) saleWhere.number = { contains: ticketNumber, mode: "insensitive" };

    if (productName) itemWhere.product = { ...itemWhere.product, name: { contains: productName, mode: "insensitive" } };

    // Filter by Branch Name (Sale -> Branch -> Name OR Product -> Branch -> Name if we want strict? Display shows sale branch usually or product?
    // The display shows `item.sale?.branch?.name`. So we filter Sale Branch.
    if (branchName) saleWhere.branch = { name: { contains: branchName, mode: "insensitive" } };

    // Filter by Seller Name
    if (sellerName) saleWhere.user = { name: { contains: sellerName, mode: "insensitive" } };

    if (search) {
        const searchNumber = parseInt(search);
        const orConditions: any[] = [
            { product: { name: { contains: search, mode: "insensitive" } } },
            { sale: { user: { name: { contains: search, mode: "insensitive" } } } }
        ];

        if (!isNaN(searchNumber)) {
            orConditions.push({ sale: { number: { equals: searchNumber } } });
        }

        itemWhere.OR = orConditions;
    }

    // Combine
    itemWhere.sale = saleWhere;

    // 3. Sorting
    const orderBy: any = {};
    if (sort === "date_desc") orderBy.sale = { createdAt: "desc" };
    else if (sort === "date_asc") orderBy.sale = { createdAt: "asc" };
    else if (sort === "amount_desc") itemWhere.price = "desc"; // Sort by price? Approximate. Item doesn't have total.
    // Sorting by calculated total (price * qty) is hard in Prisma.
    // Better to sort by Date by default.

    const items = await prisma.saleItem.findMany({
        where: itemWhere,
        include: {
            product: { select: { name: true, code: true } },
            sale: {
                select: {
                    id: true,
                    number: true,
                    createdAt: true,
                    paymentMethod: true,
                    user: { select: { name: true } },
                    branch: { select: { name: true } },
                    type: true,
                    total: true,
                    paymentDetails: true
                }
            }
        },
        orderBy: { sale: { createdAt: "desc" } }, // Default sort
        take: 500 // Limit for performance
    });

    return NextResponse.json(items);
}

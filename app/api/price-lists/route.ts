import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    const branchId = (session?.user as any)?.branchId;

    let query = `SELECT * FROM "PriceList" WHERE "active" = true`;
    const params: any[] = [];

    // Isolation: Supervisors only see Global or their own branch's lists
    if (userRole === "SUPERVISOR" && branchId) {
        query += ` AND ("branchId" IS NULL OR "branchId" = $1)`;
        params.push(branchId);
    }

    query += ` ORDER BY "name" ASC`;

    const priceLists = await prisma.$queryRawUnsafe(query, ...params);
    return NextResponse.json(priceLists);
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!session || (user.role !== "ADMIN" && user.role !== "SUPERVISOR" && user.role !== "GERENTE")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const data = await req.json();
        const branchId = user.role === "SUPERVISOR" ? user.branchId : (data.branchId || null);

        // 1. Create list using standard Prisma
        const priceList = await (prisma as any).priceList.create({
            data: {
                name: data.name,
                branchId: branchId,
            }
        });

        // 2. Update percentage using Raw SQL to bypass stale client
        if (data.percentage) {
            await prisma.$executeRawUnsafe(
                `UPDATE "PriceList" SET "percentage" = $1 WHERE "id" = $2`,
                Number(data.percentage) || 0,
                priceList.id
            );
            (priceList as any).percentage = Number(data.percentage);
        }
        return NextResponse.json(priceList);
    } catch (error) {
        console.error("Error creating price list:", error);
        return NextResponse.json({ error: "Error al crear la lista de precios" }, { status: 500 });
    }
}

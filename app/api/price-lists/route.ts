import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET() {
    // Using raw SQL because Prisma Client is stale and missing 'percentage' column
    const priceLists = await prisma.$queryRawUnsafe(`
        SELECT * FROM "PriceList" 
        WHERE "active" = true 
        ORDER BY "name" ASC
    `);
    return NextResponse.json(priceLists);
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || ((session.user as any).role !== "ADMIN" && (session.user as any).role !== "SUPERVISOR")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const data = await req.json();
        // 1. Create list using standard Prisma (without percentage to avoid validation error)
        const priceList = await prisma.priceList.create({
            data: {
                name: data.name,
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

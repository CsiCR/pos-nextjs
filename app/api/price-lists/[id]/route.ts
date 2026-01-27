import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session || ((session.user as any).role !== "ADMIN" && (session.user as any).role !== "SUPERVISOR")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const data = await req.json();
        console.log(`[PUT PriceList] Start update for ${params.id}`, data);

        // 1. Update standard fields
        console.log("[PUT PriceList] Step 1: Standard update");
        const priceList = await (prisma as any).priceList.update({
            where: { id: params.id },
            data: {
                name: data.name,
                active: data.active !== undefined ? data.active : true,
            }
        });
        console.log("[PUT PriceList] Standard update success");

        // 2. Update percentage via Raw SQL
        if (data.percentage !== undefined) {
            console.log("[PUT PriceList] Step 2: Raw update percentage to", data.percentage);
            const rawRes = await prisma.$executeRawUnsafe(
                `UPDATE "PriceList" SET "percentage" = $1 WHERE "id" = $2`,
                Number(data.percentage) || 0,
                params.id
            );
            console.log("[PUT PriceList] Raw update success, result:", rawRes);
            (priceList as any).percentage = Number(data.percentage);
        }

        return NextResponse.json(priceList);
    } catch (error: any) {
        console.error("[PUT PriceList] CRITICAL ERROR:", error);
        return NextResponse.json({
            error: "Error al actualizar la lista de precios",
            details: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        // Soft delete
        const priceList = await (prisma as any).priceList.update({
            where: { id: params.id },
            data: { active: false }
        });
        return NextResponse.json(priceList);
    } catch (error) {
        console.error("Error deleting price list:", error);
        return NextResponse.json({ error: "Error al eliminar la lista de precios" }, { status: 500 });
    }
}

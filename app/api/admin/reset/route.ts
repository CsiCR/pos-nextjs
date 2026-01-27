export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const userRole = (session?.user as any)?.role;

        // Strict Admin check
        if (!session || userRole !== "ADMIN") {
            return NextResponse.json({ error: "No autorizado. Solo administradores pueden realizar esta acción." }, { status: 403 });
        }

        const body = await req.json();
        if (body.confirmText !== "ELIMINAR") {
            return NextResponse.json({ error: "Confirmación inválida." }, { status: 400 });
        }

        console.log("🔥 INICIANDO RESET DE FÁBRICA...");

        await (prisma as any).$transaction(async (tx: any) => {
            // 1. Delete transactional data
            await tx.paymentDetail.deleteMany({});
            await tx.saleItem.deleteMany({});
            await tx.settlement.deleteMany({});
            await tx.sale.deleteMany({});
            await tx.shift.deleteMany({});

            // 2. Delete product-related data
            await tx.stock.deleteMany({});
            await tx.productPrice.deleteMany({});
            await tx.product.deleteMany({});
            await tx.category.deleteMany({});
            await tx.priceList.deleteMany({});

            // 2.1 Delete Measurement Units (Child units first, then base units)
            await tx.measurementUnit.deleteMany({
                where: { baseUnitId: { not: null } }
            });
            await tx.measurementUnit.deleteMany({});

            console.log("✅ Reset completado con éxito.");
        }, {
            maxWait: 60000,
            timeout: 60000
        });

        return NextResponse.json({ success: true, message: "Sistema restablecido de fábrica" });
    } catch (error: any) {
        console.error("❌ Error en Reset de Fábrica:", error);
        return NextResponse.json({ error: error.message || "Error interno al restablecer" }, { status: 500 });
    }
}

export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const { id } = params;
        const { justifications } = await req.json(); // { productId: "justification" }

        const transfer = await (prisma as any).stockTransfer.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!transfer) return NextResponse.json({ error: "Traspaso no encontrado" }, { status: 404 });
        if (transfer.status !== "PENDIENTE") return NextResponse.json({ error: "El traspaso ya ha sido emitido o cancelado" }, { status: 400 });

        // Validate if module is enabled
        const settings = (await prisma.systemSetting.findUnique({ where: { key: "global" } })) as any;
        if (settings && !settings.isClearingEnabled) {
            return NextResponse.json({ error: "El módulo de Clearing está desactivado" }, { status: 403 });
        }

        // Atomic transaction for issuance
        const result = await prisma.$transaction(async (tx) => {
            for (const item of transfer.items) {
                const stock = await tx.stock.findUnique({
                    where: { productId_branchId: { productId: item.productId, branchId: transfer.sourceBranchId } }
                });

                const currentQty = stock ? Number(stock.quantity) : 0;
                const transferQty = Number(item.quantity);

                // Security check: if stock is insufficient, justification is mandatory
                if (transferQty > currentQty) {
                    const reason = justifications?.[item.productId];
                    if (!reason || reason.trim().length < 5) {
                        throw new Error(`Se requiere una justificación válida para el producto con ID ${item.productId} por falta de stock.`);
                    }

                    // Record justification in the TransferItem
                    await tx.transferItem.update({
                        where: { id: item.id },
                        data: { issuanceJustification: reason }
                    });
                }

                // Decrement stock (can go negative if justified)
                await tx.stock.upsert({
                    where: { productId_branchId: { productId: item.productId, branchId: transfer.sourceBranchId } },
                    create: {
                        productId: item.productId,
                        branchId: transfer.sourceBranchId,
                        quantity: -transferQty
                    },
                    update: {
                        quantity: { decrement: transferQty }
                    }
                });
            }

            // Update transfer status and record the shipper
            return await (tx as any).stockTransfer.update({
                where: { id },
                data: {
                    status: "EN_TRANSITO",
                    shippedById: session.user.id
                }
            });
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Error emitting transfer:", error);
        return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
    }
}

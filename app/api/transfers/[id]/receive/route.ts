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
        const { itemsData } = await req.json(); // { itemId: { receivedQuantity: number, justification: string, photoUrl: string } }

        const transfer = await (prisma as any).stockTransfer.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!transfer) return NextResponse.json({ error: "Traspaso no encontrado" }, { status: 404 });
        if (transfer.status !== "EN_TRANSITO") return NextResponse.json({ error: "El traspaso no está en tránsito o ya fue completado" }, { status: 400 });

        // Validate if module is enabled
        const settings = (await prisma.systemSetting.findUnique({ where: { key: "global" } })) as any;
        if (settings && !settings.isClearingEnabled) {
            return NextResponse.json({ error: "El módulo de Clearing está desactivado" }, { status: 403 });
        }

        // Atomic transaction for reception
        const result = await prisma.$transaction(async (tx) => {
            for (const item of transfer.items) {
                const data = itemsData?.[item.id];
                const receivedQty = Number(data?.receivedQuantity ?? item.quantity); // Default to full if not provided (should be provided by UI)
                const sentQty = Number(item.quantity);

                // Security check: if there is a difference, justification is mandatory
                if (receivedQty !== sentQty) {
                    const reason = data?.justification;
                    if (!reason || reason.trim().length < 5) {
                        throw new Error(`Se requiere una justificación válida por la diferencia en el producto con ID ${item.productId}.`);
                    }
                }

                // 1. Update Transfer Item record
                await tx.transferItem.update({
                    where: { id: item.id },
                    data: {
                        receivedQuantity: receivedQty,
                        receptionJustification: data?.justification || null,
                        receptionPhotoUrl: data?.photoUrl || null
                    }
                });

                // 2. Increment stock in target branch
                await tx.stock.upsert({
                    where: { productId_branchId: { productId: item.productId, branchId: transfer.targetBranchId } },
                    create: {
                        productId: item.productId,
                        branchId: transfer.targetBranchId,
                        quantity: receivedQty
                    },
                    update: {
                        quantity: { increment: receivedQty }
                    }
                });
            }

            // 3. Finalize transfer
            return await (tx as any).stockTransfer.update({
                where: { id },
                data: {
                    status: "COMPLETADO",
                    confirmedById: session.user.id
                }
            });
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Error receiving transfer:", error);
        return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
    }
}

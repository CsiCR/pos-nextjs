import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { Prisma } from "@prisma/client";

// POST /api/sales/[id]/refund
export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { id: originalSaleId } = params;
        const userId = session.user.id;
        // We use the session branch for the REFUND operation (where the stock returns),
        // but typically it should match the original sale branch OR be the current branch context.
        // For now, let's assume refunds happen in the branch where the user is logged in
        // (physically receiving the item).
        let branchId = (session.user as any).branchId;

        if (!branchId) {
            const user = await prisma.user.findUnique({ where: { id: userId }, select: { branchId: true } });
            branchId = user?.branchId;
        }

        if (!branchId) {
            return NextResponse.json({ error: "Usuario sin sucursal asignada" }, { status: 400 });
        }

        // 1. Fetch Original Sale with Items and previous Refunds
        const originalSale = await prisma.sale.findUnique({
            where: { id: originalSaleId },
            include: {
                items: true,
                refunds: { include: { items: true } } as any // Force include type for self-relation
            }
        }) as any; // Cast to any to avoid recursive type issues with self-referential refunds logic for now

        if (!originalSale) {
            return NextResponse.json({ error: "Venta original no encontrada" }, { status: 404 });
        }

        // 2. Parse Request Body
        // Expected: { items: [ { productId: "...", quantity: 1 } ] }
        // Quantity here is POSITIVE (how many to return)
        const body = await req.json();
        const { items: refundItems } = body;

        if (!refundItems || refundItems.length === 0) {
            return NextResponse.json({ error: "Debe seleccionar ítems para devolver" }, { status: 400 });
        }

        // 3. Validate Constraints
        // Map original items for quick lookup
        const originalMap = new Map<string, { original: number, refunded: number, price: Prisma.Decimal, discount: Prisma.Decimal, unitId: string | null }>();

        originalSale.items.forEach(item => {
            originalMap.set(item.productId, {
                original: Number(item.quantity),
                refunded: 0,
                price: item.price,
                discount: item.discount, // Per unit discount approximation?
                // Note: SaleItem discount is usually total discount for the line.
                // If we refund partial, we should refund proportional discount.
                // Let's assume proportional for now: (ItemDiscount / ItemQty) * RefundQty 
                unitId: item.unitId
            });
        });

        // Sum up previous refunds
        if (originalSale.refunds) {
            originalSale.refunds.forEach(ref => {
                ref.items.forEach(ri => {
                    const stats = originalMap.get(ri.productId);
                    if (stats) {
                        // ri.quantity is negative in DB. We take absolute to count refunded amount.
                        stats.refunded += Math.abs(Number(ri.quantity));
                    }
                });
            });
        }

        // Check request validity
        for (const item of refundItems) {
            const stats = originalMap.get(item.productId);
            if (!stats) {
                return NextResponse.json({ error: `El producto ${item.productId} no pertenece a esta venta` }, { status: 400 });
            }

            const requestedQty = Number(item.quantity);
            if (requestedQty <= 0) {
                return NextResponse.json({ error: "Cantidad a devolver debe ser mayor a 0" }, { status: 400 });
            }

            const remainingQty = stats.original - stats.refunded;
            if (requestedQty > remainingQty) {
                return NextResponse.json({
                    error: `No puede devolver ${requestedQty} de ${item.productId}. Solo quedan ${remainingQty} disponibles/no devueltos.`
                }, { status: 400 });
            }
        }

        // 4. Check for Open Shift
        const shift = await prisma.shift.findFirst({
            where: { userId, closedAt: null }
        });
        if (!shift) {
            return NextResponse.json({ error: "No hay turno abierto para procesar la devolución" }, { status: 400 });
        }

        // 5. Process Transaction
        const refundSale = await prisma.$transaction(async (tx) => {
            let totalRefundAmount = new Prisma.Decimal(0);
            const newSaleItems = [];

            // Calculate global discount weight per unit of currency (percentage efficiency) if any
            // If original sale had 100 total, and 10 discount. Efficiency = 0.9.
            // Actually, we need to know how much discount applies to THESE specific items.
            // Simplistic approach: 
            // 1. Calculate the hypothetical subtotal of these items in the original sale (Price * Qty - ItemDiscount).
            // 2. Calculate the Ratio of (TheseItemsSubtotal / OriginalSaleSubtotalBeforeGlobalDiscount).
            // 3. Apply that Ratio * GlobalDiscount to get the "Extra Discount" to refund.
            // However, we iterate items one by one. 
            // Let's attach the "share of global discount" to each item.

            // Total Subtotal of Original Sale (Sum of all items subtotal)
            // originalSale.total is AFTER global discount? 
            // Schema usually: total = (sum(items.subtotal) - globalDiscount + adjustment)

            let originalSubtotalSum = new Prisma.Decimal(0);
            originalSale.items.forEach(i => {
                // Item Subtotal in DB usually is (Price*Qty - ItemDiscount)
                // If ItemSubtotal is not stored or we want to be sure:
                const iSub = i.price.times(i.quantity).minus(i.discount || 0);
                originalSubtotalSum = originalSubtotalSum.plus(iSub);
            });

            // Global Discount Ratio per dollar of subtotal
            // If SubtotalSum = 3000, GlobalDiscount = 25.
            // Ratio = 25 / 3000 = 0.008333... matches the ~0.83% discount.
            const globalDiscount = originalSale.discount || new Prisma.Decimal(0);
            let globalDiscountRatio = new Prisma.Decimal(0);
            if (originalSubtotalSum.gt(0)) {
                globalDiscountRatio = globalDiscount.div(originalSubtotalSum);
            }

            for (const item of refundItems) {
                const stats = originalMap.get(item.productId)!;
                const qtyToRefund = new Prisma.Decimal(item.quantity); // Positive

                // 1. Calculate Line Item "Net" before Global Discount
                // Unit Price
                const unitPrice = stats.price;
                // Unit Item Discount (Specific to item)
                const unitItemDiscount = stats.discount.div(new Prisma.Decimal(stats.original));

                // Refund Subtotal (Before Global)
                const lineItemDiscountToRefund = unitItemDiscount.times(qtyToRefund);
                const lineSubtotalBeforeGlobal = unitPrice.times(qtyToRefund).minus(lineItemDiscountToRefund);

                // 2. Calculate Share of Global Discount for this line
                // Share = SubtotalBeforeGlobal * Ratio
                const shareOfGlobalDiscount = lineSubtotalBeforeGlobal.times(globalDiscountRatio);

                // 3. Total Discount for this Refund Line = ItemDiscount + ShareGlobal
                const totalLineDiscount = lineItemDiscountToRefund.plus(shareOfGlobalDiscount);

                // 4. Final Refund Subtotal (What we pay back)
                // = (Price * Qty) - TotalDiscount
                const lineFinalSubtotal = unitPrice.times(qtyToRefund).minus(totalLineDiscount);

                // Convert to Negative for DB
                const negativeQty = qtyToRefund.negated();
                const negativeSubtotal = lineFinalSubtotal.negated();
                const negativeDiscount = totalLineDiscount.negated();

                totalRefundAmount = totalRefundAmount.plus(negativeSubtotal);

                newSaleItems.push({
                    productId: item.productId,
                    quantity: negativeQty,
                    price: stats.price, // Keep original unit price positive
                    discount: negativeDiscount, // Includes item specific + global share
                    subtotal: negativeSubtotal,
                    unitId: stats.unitId
                });

                // Restore Stock
                const product = await tx.product.findUnique({ where: { id: item.productId } });
                const targetStockBranchId = product?.branchId || branchId;

                await tx.stock.upsert({
                    where: { productId_branchId: { productId: item.productId, branchId: targetStockBranchId } },
                    update: { quantity: { decrement: negativeQty } }, // - (-1) = +1
                    create: { productId: item.productId, branchId: targetStockBranchId, quantity: negativeQty.negated() } // create with +1 if missing
                });
            }

            // Create Sale Header
            const sale = await tx.sale.create({
                data: {
                    number: undefined,
                    type: "REFUND",
                    relatedSaleId: originalSaleId,
                    userId,
                    branchId,
                    shiftId: shift.id,
                    total: totalRefundAmount, // Negative (Correctly deducted global discount share)
                    discount: new Prisma.Decimal(0), // We incorporated it into items for clarity/accounting? Or should we put it here?
                    // If we put it in items, it's safer for partial refunds. 
                    // If we put it here, we have to calculate "Global Discount Share" for the header.
                    // Storing in items (as negative discount) is fine.
                    paymentMethod: originalSale.paymentMethod,
                    cashReceived: null,
                    change: null,
                    adjustment: new Prisma.Decimal(0),
                    notes: `Devolución de venta #${originalSale.number}`,
                    items: {
                        create: newSaleItems
                    },
                    paymentDetails: {
                        create: [{
                            method: originalSale.paymentMethod,
                            amount: totalRefundAmount
                        }]
                    }
                }
            });

            return sale;
        });

        return NextResponse.json(refundSale);

    } catch (error: any) {
        console.error("Error processing refund:", error);
        return NextResponse.json({ error: error.message || "Error al procesar devolución" }, { status: 500 });
    }
}

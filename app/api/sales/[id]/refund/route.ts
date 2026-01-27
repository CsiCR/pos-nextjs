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
                refunds: { include: { items: true } } // Fetch previous refunds to validate quantities
            }
        });

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

            for (const item of refundItems) {
                const stats = originalMap.get(item.productId)!;
                const qtyToRefund = new Prisma.Decimal(item.quantity); // Positive

                // Calculate Proportional Price and Discount
                // Unit Price is constant.
                // Unit Discount = (TotalDiscountLine / OriginalQty)
                const unitDiscount = stats.discount.div(new Prisma.Decimal(stats.original));
                const lineDiscountToRefund = unitDiscount.times(qtyToRefund);

                // Subtotal Refund = (Price * Qty) - Discount
                // But since it's a refund, everything is negative.
                // We calculate positive magnitude first.
                const lineSubtotalParams = stats.price.times(qtyToRefund).minus(lineDiscountToRefund);

                // Convert to Negative for DB
                const negativeQty = qtyToRefund.negated();
                const negativeSubtotal = lineSubtotalParams.negated();
                // Negative discount? Yes, if we are reversing the transaction.
                // If original was: Price 100, Disc 10, Total 90.
                // Refund should be: Price 100, Disc 10, Total 90 (but all credit/negative flows).
                // Actually, SaleItem structure:
                // Quantity: -1
                // Price: 100 (Price doesn't change sign)
                // Discount: ?? 
                // Subtotal: -90
                // Logic: subtotal = (price * quantity) - discount
                // -90 = (100 * -1) - discount
                // -90 = -100 - discount => discount = -10.
                // So discount must also be negative.
                const negativeDiscount = lineDiscountToRefund.negated();

                totalRefundAmount = totalRefundAmount.plus(negativeSubtotal);

                newSaleItems.push({
                    productId: item.productId,
                    quantity: negativeQty,
                    price: stats.price, // Keep original unit price positive
                    discount: negativeDiscount,
                    subtotal: negativeSubtotal,
                    unitId: stats.unitId
                });

                // Restore Stock
                // We decrement by the negative quantity (which adds stock)
                // Target branch: The Refunds usually return stock to the CURRENT branch or the ORIGINAL branch?
                // Physical return: Items are physically now in `branchId` (the session branch).
                // So we should add stock to `branchId`. 
                // BUT, if the product belongs to another branch (Clearing/Consignment), 
                // where does the stock physically go? 
                // POS Logic: Stock is tracked by `productId + branchId`.
                // If I am in Branch A, and I sold a product from Branch B. 
                // When I return it, does it go to Branch A's stock or back to Branch B?
                // Usually, if it's a cross-branch sale, stock was decremented from Branch B.
                // If customer returns to Branch A, logically Branch A now has the stock.
                // SO we should increment Stock in Current Branch (A).
                // However, if the product is OWNED by Branch B, can Branch A have stock of it?
                // The Data Model supports `Stock { productId, branchId }`. So yes.

                // Wait, `originalSale` items track where stock came from? 
                // The API logic for sale was:
                // `targetBranchId = product.branchId || branchId`
                // It decrements stock from the OWNER branch (if product has owner).
                // So, if I return it, it should go back to the OWNER branch?
                // If I physically have it in Branch A, but it belongs to Branch B,
                // and I sold it from Branch B's stock... 
                // If I return it, I should credit Branch B's stock if I want to reverse the transaction exactly.
                // Let's stick to: "Reverse the original stock movement".
                // Original movement: Decrement from Product's Owner Branch.
                // Refund movement: Increment to Product's Owner Branch.

                // We need to fetch product to know owner branch? 
                // We have productId. We assumed in original sale that `product.branchId` dictated stock source.
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
                    number: undefined, // Auto-inc
                    type: "REFUND", // SaleType Enum
                    relatedSaleId: originalSaleId,
                    userId,
                    branchId,
                    shiftId: shift.id,
                    total: totalRefundAmount, // Negative
                    discount: new Prisma.Decimal(0), // Global discount adjustments? Let's ignore for item refund complexity for now.
                    paymentMethod: originalSale.paymentMethod, // Inherit method
                    cashReceived: null, // Not relevant for refund record usually, or negative?
                    change: null,
                    adjustment: new Prisma.Decimal(0),
                    notes: `Devolución de venta #${originalSale.number}`,
                    items: {
                        create: newSaleItems
                    },
                    // Payment Details? 
                    // If original was mixed, we might need to ask USER how to refund (Cash? Transfer?).
                    // For MVP, we assume refund is matched to original method. 
                    // We should create a negative PaymentDetail to balance the books (Clearing).
                    paymentDetails: {
                        create: [{
                            method: originalSale.paymentMethod,
                            amount: totalRefundAmount // Negative amount
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

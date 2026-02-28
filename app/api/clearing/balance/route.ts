export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const requestedBranchId = searchParams.get("branchId");

    // Rule: Only Admin/Gerente can query other branches. Supervisor restricted to own.
    const userRole = (session.user as any).role;
    const userBranchId = (session.user as any).branchId;

    // Check if module is enabled
    const settings = (await prisma.systemSetting.findUnique({ where: { key: "global" } })) as any;
    if (settings && !settings.isClearingEnabled && userRole !== "ADMIN") {
        return NextResponse.json({ error: "El módulo de Clearing está desactivado" }, { status: 403 });
    }

    let targetBranchId = userBranchId;
    const isAdmin = userRole === "ADMIN" || userRole === "GERENTE";

    if (isAdmin && requestedBranchId) {
        targetBranchId = requestedBranchId;
    } else if (!isAdmin && requestedBranchId && requestedBranchId !== userBranchId) {
        return NextResponse.json({ error: "Forbidden: Cannot view other branch clearing" }, { status: 403 });
    }

    // If no branch context (e.g. Admin view global?), handle later. For now assume branch context.
    if (!targetBranchId && !isAdmin) {
        return NextResponse.json({ error: "No branch context" }, { status: 400 });
    }

    // If Admin and no targetBranchId, maybe return Matrix? Let's stick to Node-based view for now.

    try {
        const balances: any[] = [];
        const branchMap = new Map<string, string>(); // id -> name

        // --- 1. Calculate DEBTS (What I owe to others) ---
        // Need to fetch SALES that contain cross-branch items to determine payment mix
        const debtSales = await prisma.sale.findMany({
            where: {
                branchId: targetBranchId, // My sales
                items: {
                    some: {
                        product: {
                            branchId: { not: targetBranchId },
                            NOT: { branchId: null }
                        }
                    }
                }
            },
            include: {
                items: { include: { product: { include: { branch: true } } } },
                paymentDetails: true
            }
        });

        const debtsByBranch: any = {}; // { [branchId]: { amount: 0, payments: { CASH: 0, CARD: 0 } } }

        debtSales.forEach(sale => {
            const saleTotal = Number(sale.total); // Final total after discounts
            if (saleTotal <= 0) return; // Ignore zero/negative sales for clearing safety

            // Calculate how much of this sale belongs to others
            const branchDebts: { [bid: string]: number } = {};
            let totalDebtInSale = 0;

            sale.items.forEach(item => {
                const pBranch = item.product.branchId;
                if (pBranch && pBranch !== targetBranchId) {
                    const amount = Number(item.subtotal);
                    branchDebts[pBranch] = (branchDebts[pBranch] || 0) + amount;
                    totalDebtInSale += amount;
                    // Track branch name
                    if (!branchMap.has(pBranch)) branchMap.set(pBranch, item.product.branch?.name || "Unknown");
                }
            });

            // Distribute payments proportionally
            Object.entries(branchDebts).forEach(([creditorId, debtAmount]) => {
                const ratio = debtAmount / saleTotal;

                if (!debtsByBranch[creditorId]) debtsByBranch[creditorId] = { id: creditorId, amount: 0, payments: {} };
                debtsByBranch[creditorId].amount += debtAmount;

                // Allocate payments
                // If Mixed
                if (sale.paymentDetails && sale.paymentDetails.length > 0) {
                    sale.paymentDetails.forEach(pd => {
                        const method = pd.method;
                        const allocated = Number(pd.amount) * ratio;
                        debtsByBranch[creditorId].payments[method] = (debtsByBranch[creditorId].payments[method] || 0) + allocated;
                    });
                } else {
                    const method = sale.paymentMethod;
                    const allocated = debtAmount;
                    debtsByBranch[creditorId].payments[method] = (debtsByBranch[creditorId].payments[method] || 0) + allocated;
                }
            });
        });

        // --- 2. Calculate RECEIVABLES (What others owe me) ---
        // Fetch Sales from OTHERS that contain MY products
        const creditSales = await prisma.sale.findMany({
            where: {
                branchId: { not: targetBranchId }, // Other's sales
                items: {
                    some: {
                        product: { branchId: targetBranchId } // My items
                    }
                }
            },
            include: {
                items: { include: { product: true } },
                branch: true, // The Debtor Branch info
                paymentDetails: true
            }
        });

        const receivablesByBranch: any = {};

        creditSales.forEach(sale => {
            const debtorId = sale.branchId!; // The branch that made the sale
            if (!branchMap.has(debtorId)) branchMap.set(debtorId, sale.branch?.name || "Unknown");

            const saleTotal = Number(sale.total);
            if (saleTotal <= 0) return;

            // Calculate how much of this sale belongs to ME
            let myShareInSale = 0;
            sale.items.forEach(item => {
                if (item.product.branchId === targetBranchId) {
                    myShareInSale += Number(item.subtotal);
                }
            });

            if (myShareInSale > 0) {
                if (!receivablesByBranch[debtorId]) receivablesByBranch[debtorId] = { id: debtorId, amount: 0, payments: {} };
                receivablesByBranch[debtorId].amount += myShareInSale;

                const ratio = myShareInSale / saleTotal;

                if (sale.paymentDetails && sale.paymentDetails.length > 0) {
                    sale.paymentDetails.forEach(pd => {
                        const method = pd.method;
                        const allocated = Number(pd.amount) * ratio;
                        receivablesByBranch[debtorId].payments[method] = (receivablesByBranch[debtorId].payments[method] || 0) + allocated;
                    });
                } else {
                    const method = sale.paymentMethod;
                    const allocated = myShareInSale;
                    receivablesByBranch[debtorId].payments[method] = (receivablesByBranch[debtorId].payments[method] || 0) + allocated;
                }
            }
        });


        // --- 3. Calculate SETTLEMENTS ---
        const outgoingSettlements = await prisma.settlement.findMany({ where: { sourceBranchId: targetBranchId } });
        const incomingSettlements = await prisma.settlement.findMany({ where: { targetBranchId: targetBranchId } });

        outgoingSettlements.forEach(s => !branchMap.has(s.targetBranchId) && branchMap.set(s.targetBranchId, "Branch " + s.targetBranchId));
        incomingSettlements.forEach(s => !branchMap.has(s.sourceBranchId) && branchMap.set(s.sourceBranchId, "Branch " + s.sourceBranchId));


        // --- 4. Final Balance Construction ---
        for (const [otherId, otherName] of branchMap.entries()) {
            const debtData = debtsByBranch[otherId] || { amount: 0, payments: {} };
            const creditData = receivablesByBranch[otherId] || { amount: 0, payments: {} };

            const debtRaw = debtData.amount;
            const receivableRaw = creditData.amount;

            const paidConfirmed = outgoingSettlements
                .filter(s => s.targetBranchId === otherId && s.status === "CONFIRMED")
                .reduce((sum, s) => sum + Number(s.amount), 0);

            const paidPending = outgoingSettlements
                .filter(s => s.targetBranchId === otherId && s.status === "PENDING")
                .reduce((sum, s) => sum + Number(s.amount), 0);

            const receivedConfirmed = incomingSettlements
                .filter(s => s.sourceBranchId === otherId && s.status === "CONFIRMED")
                .reduce((sum, s) => sum + Number(s.amount), 0);

            const receivedPending = incomingSettlements
                .filter(s => s.sourceBranchId === otherId && s.status === "PENDING")
                .reduce((sum, s) => sum + Number(s.amount), 0);

            const remainingDebt = debtRaw - paidConfirmed;
            const remainingReceivable = receivableRaw - receivedConfirmed;
            const netBalance = remainingReceivable - remainingDebt;

            // Simplify Payment Breakdown formatting
            // We return the raw object { EFECTIVO: 1200, TARJETA: 300 }
            const debtPayments = debtData.payments;
            const creditPayments = creditData.payments;

            balances.push({
                branchId: otherId,
                branchName: otherName,

                rawDebt: debtRaw,
                debtBreakdown: debtPayments, // [NEW]
                paidConfirmed,
                paidPending,
                remainingDebt,

                rawReceivable: receivableRaw,
                receivableBreakdown: creditPayments, // [NEW]
                receivedConfirmed,
                receivedPending,
                remainingReceivable,

                netBalance
            });
        }

        return NextResponse.json({
            myBranchId: targetBranchId,
            balances
        });

    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

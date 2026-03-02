import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function POST(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    try {
        const body = await req.json();
        const { amount, description, method, paymentDetails } = body;

        if (!amount || parseFloat(amount) <= 0) {
            return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 });
        }

        const paymentAmount = parseFloat(amount);

        // Find current user's active shift - REQUIRED
        const activeShift = await prisma.shift.findFirst({
            where: {
                userId: session.user.id,
                closedAt: null
            }
        });

        if (!activeShift) {
            return NextResponse.json({ error: "No hay un turno abierto. Debes abrir caja para recibir pagos." }, { status: 400 });
        }

        // Prepare payment details for the database
        let detailsToCreate: any[] = [];
        if (method === "MIXTO" && Array.isArray(paymentDetails)) {
            detailsToCreate = paymentDetails.map((pd: any) => ({
                method: pd.method,
                amount: parseFloat(pd.amount)
            }));
        } else {
            detailsToCreate = [{
                method: method || "EFECTIVO",
                amount: paymentAmount
            }];
        }

        // Perform transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create transaction record (vinculado al shiftId)
            const transaction = await (tx.customerTransaction as any).create({
                data: {
                    customerId: params.id,
                    type: "PAYMENT",
                    method: method || "EFECTIVO",
                    amount: paymentAmount,
                    description: description || `Abono (${method || 'EFECTIVO'})`,
                    shiftId: activeShift.id,
                    paymentDetails: {
                        create: detailsToCreate
                    }
                },
            });

            // 2. Update customer balance (subtract payment)
            const customer = await tx.customer.update({
                where: { id: params.id },
                data: {
                    balance: { decrement: paymentAmount },
                },
            });

            return { transaction, customer };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error processing customer payment:", error);
        return NextResponse.json({ error: "Error al procesar el pago" }, { status: 500 });
    }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    try {
        const payments = await (prisma.customerTransaction as any).findMany({
            where: {
                customerId: params.id,
                type: "PAYMENT",
            },
            include: {
                paymentDetails: true
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(payments);
    } catch (error) {
        console.error("Error fetching customer payments:", error);
        return NextResponse.json({ error: "Error al obtener pagos" }, { status: 500 });
    }
}

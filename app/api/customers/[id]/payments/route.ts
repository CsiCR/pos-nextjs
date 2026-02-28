import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function POST(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    try {
        const body = await req.json();
        const { amount, description } = body;

        if (!amount || parseFloat(amount) <= 0) {
            return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 });
        }

        const paymentAmount = parseFloat(amount);

        // Perform transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create transaction record
            const transaction = await tx.customerTransaction.create({
                data: {
                    customerId: params.id,
                    type: "PAYMENT",
                    amount: paymentAmount,
                    description: description || "Abono a cuenta corriente",
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
        const payments = await prisma.customerTransaction.findMany({
            where: {
                customerId: params.id,
                type: "PAYMENT",
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(payments);
    } catch (error) {
        console.error("Error fetching customer payments:", error);
        return NextResponse.json({ error: "Error al obtener pagos" }, { status: 500 });
    }
}

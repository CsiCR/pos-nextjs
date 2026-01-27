import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    try {
        const sale = await prisma.sale.findUnique({
            where: { id: params.id },
            include: {
                user: { select: { name: true } },
                branch: true,
                items: {
                    include: {
                        product: { select: { name: true, code: true } }
                    }
                },
                paymentDetails: true
            }
        });

        if (!sale) {
            return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
        }

        return NextResponse.json(sale);
    } catch (error) {
        console.error("Error fetching sale details:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}

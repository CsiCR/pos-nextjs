import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    try {
        const customer = await prisma.customer.findUnique({
            where: { id: params.id },
            include: {
                transactions: {
                    orderBy: { createdAt: "desc" },
                    take: 50,
                },
            },
        });

        if (!customer) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

        return NextResponse.json(customer);
    } catch (error) {
        console.error("Error fetching customer:", error);
        return NextResponse.json({ error: "Error al obtener detalle del cliente" }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    try {
        const body = await req.json();
        const { name, document, email, phone, address, maxCredit, active } = body;

        const customer = await prisma.customer.update({
            where: { id: params.id },
            data: {
                name,
                document,
                email,
                phone,
                address,
                maxCredit: maxCredit !== undefined ? parseFloat(maxCredit) : undefined,
                active,
            },
        });

        return NextResponse.json(customer);
    } catch (error: any) {
        console.error("Error updating customer:", error);
        return NextResponse.json({ error: "Error al actualizar cliente" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    try {
        // Soft delete
        const customer = await prisma.customer.update({
            where: { id: params.id },
            data: { active: false },
        });

        return NextResponse.json(customer);
    } catch (error) {
        console.error("Error deleting customer:", error);
        return NextResponse.json({ error: "Error al desactivar cliente" }, { status: 500 });
    }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const activeOnly = searchParams.get("activeOnly") === "true";

    try {
        const customers = await prisma.customer.findMany({
            where: {
                AND: [
                    activeOnly ? { active: true } : {},
                    {
                        OR: [
                            { name: { contains: search, mode: "insensitive" } },
                            { document: { contains: search, mode: "insensitive" } },
                            { phone: { contains: search, mode: "insensitive" } },
                        ],
                    },
                ],
            },
            orderBy: { name: "asc" },
        });

        return NextResponse.json(customers);
    } catch (error) {
        console.error("Error fetching customers:", error);
        return NextResponse.json({ error: "Error al obtener clientes" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    try {
        const body = await req.json();
        const { name, document, email, phone, address, maxCredit } = body;

        if (!name) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });

        const customer = await prisma.customer.create({
            data: {
                name,
                document,
                email,
                phone,
                address,
                maxCredit: parseFloat(maxCredit || "0"),
            },
        });

        return NextResponse.json(customer);
    } catch (error: any) {
        console.error("Error creating customer:", error);
        if (error.code === 'P2002') {
            return NextResponse.json({ error: "Ya existe un cliente con ese documento" }, { status: 400 });
        }
        return NextResponse.json({ error: "Error al crear cliente" }, { status: 500 });
    }
}

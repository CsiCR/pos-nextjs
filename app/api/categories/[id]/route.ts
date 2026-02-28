export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as any;
        if (!session || (user?.role !== "ADMIN" && user?.role !== "GERENTE")) {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        }

        const { name, defaultMinStock } = await req.json();
        if (!name) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

        const category = await prisma.category.update({
            where: { id: params.id },
            data: {
                name,
                defaultMinStock: defaultMinStock ? parseFloat(defaultMinStock) : 0
            }
        });

        return NextResponse.json(category);
    } catch (error: any) {
        console.error("PUT Category Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as any;
        if (!session || (user?.role !== "ADMIN" && user?.role !== "GERENTE")) {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        }

        // Check if category is being used by any product
        const productCount = await prisma.product.count({
            where: { categoryId: params.id, active: true }
        });

        if (productCount > 0) {
            return NextResponse.json({
                error: `No se puede eliminar: hay ${productCount} productos usando esta categoría.`
            }, { status: 400 });
        }

        await prisma.category.delete({
            where: { id: params.id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("DELETE Category Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

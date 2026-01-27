import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const id = params.id;
    const data = await req.json();

    try {
        const unit = await prisma.measurementUnit.update({
            where: { id },
            data: {
                name: data.name,
                symbol: data.symbol,
                isBase: data.isBase,
                factor: data.conversionFactor ? Number(data.conversionFactor) : 1.0,
                decimals: Number(data.decimals) >= 0 ? Number(data.decimals) : 2,
                baseUnitId: data.baseUnitId || null
            }
        });
        return NextResponse.json(unit);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const id = params.id;
    try {
        await prisma.measurementUnit.delete({
            where: { id }
        });
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

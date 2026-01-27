import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (!session || (role !== "ADMIN" && role !== "GERENTE" && role !== "SUPERVISOR")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const units = await prisma.measurementUnit.findMany({
        orderBy: { name: "asc" },
        include: { baseUnit: true }
    });
    return NextResponse.json(units);
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const data = await req.json();
    try {
        const unit = await prisma.measurementUnit.create({
            data: {
                name: data.name,
                symbol: data.symbol,
                isBase: data.isBase ?? false,
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

export async function PUT(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Extract ID from URL is tricky in Next.js 13 route.ts without [id] folder unless we use query param or parse body.
    // But REST convention usually puts ID in URL.
    // However, the frontend is calling `/api/measurement-units/${unitForm.id}` (which implies a dynamic route) OR sending ID in body to the main route?
    // Wait, the frontend code I wrote says: `url = unitForm.id ? /api/measurement-units/${unitForm.id} : ...`
    // This means I need to create a `app/api/measurement-units/[id]/route.ts` file! I cannot handle ID-based PUT in the main route.ts simply via URL param unless I parse it manually, but Next.js file system routing triggers separate handlers.

    // Correction: I should check if the [id] folder exists. If not, I must create it.
    return NextResponse.json({ error: "Method not implemented in base route" }, { status: 405 });
}

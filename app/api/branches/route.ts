import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "GERENTE" && session.user.role !== "SUPERVISOR" && session.user.role !== "CAJERO")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const where: any = {};
    // Restricted Scoping for Supervisor
    if (session.user.role === "SUPERVISOR") {
        where.id = (session.user as any).branchId;
    }

    const branches = await prisma.branch.findMany({
        where,
        orderBy: { name: "asc" }
    });
    return NextResponse.json(branches);
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const data = await req.json();
    const branch = await prisma.branch.create({
        data: {
            name: data.name,
            address: data.address,
            phone: data.phone,
            active: data.active ?? true
        }
    });
    return NextResponse.json(branch);
}

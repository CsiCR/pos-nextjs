import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userRole = (session.user as any)?.role;
    const userBranchId = (session.user as any)?.branchId;

    // POS prices follow the branch that is actually selling/cashing the operation.
    // If the user has an open shift, that branch is authoritative for the current sale.
    const activeShift = await prisma.shift.findFirst({
        where: { userId: session.user.id, closedAt: null },
        select: { branchId: true }
    });
    const effectiveBranchId = activeShift?.branchId || userBranchId || null;

    const restrictedRole = userRole === "SUPERVISOR" || userRole === "CAJERO";

    const priceLists = await (prisma as any).priceList.findMany({
        where: {
            active: true,
            ...(restrictedRole
                ? {
                    OR: [
                        { branchId: null },
                        ...(effectiveBranchId ? [{ branchId: effectiveBranchId }] : [])
                    ]
                }
                : {})
        },
        orderBy: { name: "asc" }
    });

    return NextResponse.json(priceLists);
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!session || (user.role !== "ADMIN" && user.role !== "SUPERVISOR" && user.role !== "GERENTE")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    try {
        const data = await req.json();

        // Supervisors always create lists owned by their own branch.
        // Managers/Admins may intentionally create either a global list (null)
        // or a list associated with a concrete branch.
        const branchId = user.role === "SUPERVISOR" ? user.branchId : (data.branchId || null);

        if (user.role === "SUPERVISOR" && !branchId) {
            return NextResponse.json({ error: "El supervisor no tiene una sucursal asignada" }, { status: 403 });
        }

        if (branchId) {
            const branchExists = await (prisma as any).branch.findUnique({ where: { id: branchId } });
            if (!branchExists) {
                return NextResponse.json({ error: "La sucursal seleccionada no existe" }, { status: 400 });
            }
        }

        const priceList = await (prisma as any).priceList.create({
            data: {
                name: data.name,
                branchId,
                percentage: Number(data.percentage) || 0
            }
        });

        return NextResponse.json(priceList);
    } catch (error) {
        console.error("Error creating price list:", error);
        return NextResponse.json({ error: "Error al crear la lista de precios" }, { status: 500 });
    }
}

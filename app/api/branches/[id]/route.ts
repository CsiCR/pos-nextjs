import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "SUPERVISOR" && session.user.role !== "ADMIN")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = params;
    const { name, address, phone, active } = await req.json();

    try {
        const branch = await prisma.branch.update({
            where: { id },
            data: { name, address, phone, active }
        });
        return NextResponse.json(branch);
    } catch (error) {
        return NextResponse.json({ error: "Error al actualizar sucursal" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    // Only Admin or Gerente should be able to delete branches
    const role = (session?.user as any)?.role;
    if (!session || (role !== "ADMIN" && role !== "GERENTE")) {
        return NextResponse.json({ error: "Solo Administradores o Gerentes pueden eliminar sucursales" }, { status: 403 });
    }

    const { id } = params;
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";

    try {
        if (force) {
            // Transactional delete of everything related to this branch
            await prisma.$transaction(async (tx) => {
                // 1. Delete Sales Items (linked to sales of this branch)
                // Linking SaleItem to Sale to Branch is complex in Prisma deleteMany if not direct relation.
                // But SaleItem -> Sale -> Branch.
                // Easier approach: Delete Sales, which cascades to SaleItems usually? 
                // Let's check schema/prisma behavior. If schema doesn't have onDelete: Cascade, we must manual delete.
                // Assuming we need manual clean up for safety.

                // Find sales IDs first
                const sales = await tx.sale.findMany({ where: { branchId: id }, select: { id: true } });
                const saleIds = sales.map(s => s.id);

                if (saleIds.length > 0) {
                    await tx.paymentDetail.deleteMany({ where: { saleId: { in: saleIds } } });
                    await tx.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
                    await tx.sale.deleteMany({ where: { branchId: id } });
                }

                // Shifts
                await tx.shift.deleteMany({ where: { branchId: id } });

                // Stocks
                await tx.stock.deleteMany({ where: { branchId: id } });

                // Unlink Users (set branchId null)
                await tx.user.updateMany({
                    where: { branchId: id },
                    data: { branchId: null }
                });

                // Finally delete branch
                await tx.branch.delete({ where: { id } });
            });

            return NextResponse.json({ success: true, message: "Sucursal y datos asociados eliminados correctamente" });

        } else {
            // Soft checks
            const salesCount = await prisma.sale.count({ where: { branchId: id } });
            if (salesCount > 0) {
                return NextResponse.json({
                    error: "La sucursal tiene ventas registradas. Use la eliminación forzada si desea borrar todo el historial.",
                    requiresForce: true
                }, { status: 400 });
            }

            await prisma.branch.delete({ where: { id } });
            return NextResponse.json({ success: true });
        }

    } catch (error) {
        console.error("Error deleting branch:", error);
        return NextResponse.json({ error: "Error al eliminar sucursal" }, { status: 500 });
    }
}

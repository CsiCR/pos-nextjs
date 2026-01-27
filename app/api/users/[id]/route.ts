import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import bcrypt from "bcryptjs";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "SUPERVISOR" && session.user.role !== "ADMIN")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = params;
    const { email, password, name, role, branchId, active } = await req.json();

    const dataToUpdate: any = {
        email,
        name,
        role,
        active,
        // If branchId is explicitly null (for Gerente), allow it. If undefined, ignore.
        branchId: branchId === "" ? null : branchId
    };

    // Only hash and update password if provided
    if (password && password.trim() !== "") {
        dataToUpdate.password = await bcrypt.hash(password, 10);
    }

    try {
        const user = await prisma.user.update({
            where: { id },
            data: dataToUpdate
        });
        return NextResponse.json(user);
    } catch (error) {
        return NextResponse.json({ error: "Error al actualizar usuario" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "SUPERVISOR" && session.user.role !== "ADMIN")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = params;

    // Prevent deleting yourself
    if (session.user.id === id) {
        return NextResponse.json({ error: "No puedes eliminar tu propio usuario" }, { status: 400 });
    }

    try {
        await prisma.user.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        // Likely foreign key constraint (sales exist)
        return NextResponse.json({ error: "No se puede eliminar: El usuario tiene ventas registradas. Intente desactivarlo." }, { status: 400 });
    }
}

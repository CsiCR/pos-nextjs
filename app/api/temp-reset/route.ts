export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const emailToReset = url.searchParams.get("email");
    const newPassword = url.searchParams.get("password") || "Admin2026!";

    // List all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true
      }
    });

    let message = "Usuarios listados. Para resetear: ?email=correo@ejemplo.com&password=NuevaPassword";

    if (emailToReset) {
      const user = users.find(u => u.email === emailToReset);
      if (!user) {
        return NextResponse.json({ error: "Usuario no encontrado", users });
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { email: emailToReset },
        data: { password: hashed }
      });
      message = `Contraseña de ${emailToReset} cambiada a: ${newPassword}`;
    }

    return NextResponse.json({
      message,
      users
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

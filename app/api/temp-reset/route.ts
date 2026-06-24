export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const emailToReset = url.searchParams.get("email");
    const newPassword = url.searchParams.get("password") || "Admin2026!";
    const createUser = url.searchParams.get("create") === "true";
    const name = url.searchParams.get("name") || "Admin";
    const role = url.searchParams.get("role") || "ADMIN";

    // List all users
    let users: any[] = [];
    try {
      users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true
        }
      });
    } catch (dbError: any) {
      return NextResponse.json({ 
        error: "No se pudo consultar los usuarios. ¿La base de datos tiene las tablas creadas?",
        details: dbError.message 
      }, { status: 500 });
    }

    let message = "Usuarios listados. Para resetear: ?email=correo@ejemplo.com&password=NuevaPassword. Para crear: ?email=correo@ejemplo.com&password=NuevaPassword&create=true&name=AdminName&role=ADMIN";

    if (emailToReset) {
      const user = users.find(u => u.email === emailToReset);
      
      if (createUser) {
        const hashed = await bcrypt.hash(newPassword, 10);
        const newUser = await prisma.user.create({
          data: {
            email: emailToReset,
            password: hashed,
            name: name,
            role: role as any,
            active: true
          }
        });
        message = `Usuario ${newUser.email} creado correctamente con rol ${newUser.role} y contraseña: ${newPassword}`;
        // Refresh list
        users = await prisma.user.findMany({
          select: { id: true, email: true, name: true, role: true, active: true }
        });
      } else {
        if (!user) {
          return NextResponse.json({ error: "Usuario no encontrado. Si deseas crearlo, añade &create=true", users });
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
          where: { email: emailToReset },
          data: { password: hashed }
        });
        message = `Contraseña de ${emailToReset} cambiada a: ${newPassword}`;
      }
    }

    return NextResponse.json({
      message,
      users
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = body?.email;
    const password = body?.password;
    const name = body?.name;
    const role = body?.role;
    
    if (!email || !password || !name) {
      return NextResponse.json({ error: "Campos requeridos" }, { status: 400 });
    }
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 400 });
    }
    const hashed = await bcrypt.hash(password, 10);
    const validRole = role === "SUPERVISOR" ? "SUPERVISOR" : "CAJERO";
    const user = await prisma.user.create({
      data: { email, password: hashed, name, role: validRole }
    });
    return NextResponse.json({ id: user.id, email: user.email, name: user.name });
  } catch (e: any) {
    console.error("Signup error:", e?.message);
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 400 });
    }
    return NextResponse.json({ error: "Error al crear usuario" }, { status: 500 });
  }
}

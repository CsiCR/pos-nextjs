export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

import { authOptions } from "@/lib/auth-options";
import { getServerSession } from "next-auth";

export async function GET() {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(categories);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!session || (user?.role !== "ADMIN" && user?.role !== "GERENTE")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { name, defaultMinStock } = await req.json();
  if (!name) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

  const category = await prisma.category.create({
    data: {
      name,
      defaultMinStock: defaultMinStock ? parseFloat(defaultMinStock) : 0
    }
  });
  return NextResponse.json(category);
}

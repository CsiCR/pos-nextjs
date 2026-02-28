import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({ error: "Módulo Cuentas Corrientes desactivado temporalmente" }, { status: 503 });
}

export async function POST() {
    return NextResponse.json({ error: "Módulo Cuentas Corrientes desactivado temporalmente" }, { status: 503 });
}

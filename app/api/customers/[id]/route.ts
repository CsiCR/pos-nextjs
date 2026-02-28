import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({ error: "Módulo Cuentas Corrientes desactivado temporalmente" }, { status: 503 });
}

export async function PUT() {
    return NextResponse.json({ error: "Módulo Cuentas Corrientes desactivado temporalmente" }, { status: 503 });
}

export async function DELETE() {
    return NextResponse.json({ error: "Módulo Cuentas Corrientes desactivado temporalmente" }, { status: 503 });
}

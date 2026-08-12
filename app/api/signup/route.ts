export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

/**
 * Public signup is intentionally disabled.
 * User creation must go through the authenticated /api/users flow.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Registro público deshabilitado" },
    { status: 403 }
  );
}

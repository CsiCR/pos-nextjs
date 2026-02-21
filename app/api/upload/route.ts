export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { uploadToS3 } from "@/lib/s3";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const url = await uploadToS3(buffer, file.name, file.type);

        return NextResponse.json({ url });
    } catch (error: any) {
        console.error("Error uploading file:", error);
        return NextResponse.json({ error: error.message || "Error al subir archivo" }, { status: 500 });
    }
}

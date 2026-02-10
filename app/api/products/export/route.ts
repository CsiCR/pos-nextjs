export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const userRole = (session?.user as any)?.role;
        const branchId = (session?.user as any)?.branchId;

        // Filter Logic
        const andConditions: any[] = [{ active: true }];

        // Branch visibility logic (same as in GET products API)
        if (userRole === "SUPERVISOR") {
            if (branchId) {
                andConditions.push({
                    OR: [{ branchId: null }, { branchId: branchId }]
                });
            } else {
                andConditions.push({ branchId: null });
            }
        }

        const products = await (prisma as any).product.findMany({
            where: { AND: andConditions },
            include: {
                category: true,
                baseUnit: true,
                stocks: {
                    where: { branchId: branchId || undefined }
                }
            },
            orderBy: { name: "asc" }
        });

        // Format as CSV
        const headers = ["Código", "EAN", "Nombre", "Categoría", "Unidad", "Stock", "Stock Mínimo", "Precio Base"];
        const rows = products.map((p: any) => {
            const stock = p.stocks?.[0]?.quantity || 0;
            return [
                p.code || "",
                p.ean || "",
                p.name || "",
                p.category?.name || "General",
                p.baseUnit?.symbol || "",
                stock.toString(),
                (p.minStock || 0).toString(),
                (p.basePrice || 0).toString()
            ];
        });

        const csvContent = [
            headers.join(","),
            ...rows.map((row: string[]) => row.map((cell: string) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        // Add BOM for Excel UTF-8 compatibility
        const bom = "\uFEFF";
        const response = new NextResponse(bom + csvContent);

        const date = new Date().toISOString().split("T")[0];
        response.headers.set("Content-Type", "text/csv; charset=utf-8");
        response.headers.set("Content-Disposition", `attachment; filename=stock_actual_${date}.csv`);

        return response;
    } catch (error: any) {
        console.error("Export Stock Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

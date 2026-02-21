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

        const search = searchParams.get("search") || "";
        const categoryId = searchParams.get("categoryId");
        const filterMode = searchParams.get("filterMode") || "all";
        const onlyMyBranch = searchParams.get("onlyMyBranch") === "true";
        const filterBranchId = searchParams.get("branchId"); // Selected branch in dropdown

        // 1. Build Query Conditions (Sync with products API)
        const andConditions: any[] = filterMode === "inactive" ? [{ active: false }] : [{ active: true }];

        if (search) {
            andConditions.push({
                OR: [
                    { code: { contains: search, mode: "insensitive" } },
                    { name: { contains: search, mode: "insensitive" } },
                    { ean: { contains: search, mode: "insensitive" } }
                ]
            });
        }

        if (categoryId) {
            andConditions.push({ categoryId });
        }

        // Ownership & Visibility Logic (Sync with products API)
        if (onlyMyBranch && branchId) {
            andConditions.push({
                OR: [
                    { branchId: branchId },
                    { stocks: { some: { branchId: branchId } } }
                ]
            });
        } else if (userRole === "SUPERVISOR") {
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
                    where: filterBranchId ? { branchId: filterBranchId } : (branchId ? { branchId: branchId } : undefined),
                    include: { branch: true }
                }
            },
            orderBy: { name: "asc" }
        });

        // Format as CSV
        const headers = ["Código", "EAN", "Nombre", "Categoría", "Unidad", "Stock", "Stock Mínimo", "Precio Base"];
        const rows = products.map((p: any) => {
            // Calculate Stock & Price (Sync with listing logic)
            const targetBranchId = filterBranchId || branchId;
            let displayStock = 0;
            if (targetBranchId) {
                const bStock = p.stocks?.find((s: any) => s.branchId === targetBranchId);
                displayStock = bStock ? Number(bStock.quantity) : 0;
            } else {
                displayStock = p.stocks?.reduce((acc: number, s: any) => acc + Number(s.quantity), 0) || 0;
            }

            return [
                p.code || "",
                p.ean || "",
                p.name || "",
                p.category?.name || "General",
                p.baseUnit?.symbol || "",
                displayStock.toString(),
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

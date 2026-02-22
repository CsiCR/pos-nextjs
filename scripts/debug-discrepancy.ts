import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    console.log("🕵️ Investigando discrepancia 25 vs 271 para GERENTE...");

    const effectiveBranchId = null; // Gerente Global
    const stockProductWhere: any = { active: true };

    const stockProducts = await (prisma as any).product.findMany({
        where: stockProductWhere,
        select: {
            id: true,
            name: true,
            minStock: true,
            stocks: {
                include: { branch: true }
            }
        }
    });

    let lowStockCount = 0;
    let missingCount = 0;
    let productsWithZeroStockTotal = 0;

    const criticalList: string[] = [];

    for (const p of stockProducts) {
        // Global logic as in app/api/dashboard/route.ts
        const totalQty = (p as any).stocks?.reduce((acc: number, s: any) => acc + Number(s.quantity), 0) || 0;
        const totalMin = (p as any).stocks?.reduce((acc: number, s: any) => acc + Number(s.minStock || 0), 0) || Number((p as any).minStock || 0);

        if (totalQty <= 0) {
            productsWithZeroStockTotal++;
            // This is the current dashboard logic (if I read it correctly)
            missingCount++;
            criticalList.push(p.name);
        } else if (totalQty < totalMin) {
            lowStockCount++;
        }
    }

    console.log(`\n📊 Dashboard Global (Simulado):`);
    console.log(`- Productos Activos: ${stockProducts.length}`);
    console.log(`- Productos con Stock Total <= 0: ${productsWithZeroStockTotal}`);
    console.log(`- Alertas Críticas (Actual): ${missingCount}`);
    console.log(`- Alertas Stock Bajo: ${lowStockCount}`);

    // Let's try the "Expected" logic: qty <= 0 AND min > 0
    let missingExpected = 0;
    for (const p of stockProducts) {
        const totalQty = (p as any).stocks?.reduce((acc: number, s: any) => acc + Number(s.quantity), 0) || 0;
        const totalMin = (p as any).stocks?.reduce((acc: number, s: any) => acc + Number(s.minStock || 0), 0) || Number((p as any).minStock || 0);
        if (totalQty <= 0 && totalMin > 0) {
            missingExpected++;
        }
    }
    console.log(`- Alertas Críticas (Si pidiéramos Mínimo > 0): ${missingExpected}`);

    console.log("\nPrimeros 5 críticos:");
    criticalList.slice(0, 5).forEach(m => console.log(`- ${m}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    console.log("DIAGNOSTICO: Comparando Dashboard vs Catalogo (Vista Gerente Global)");

    const products = await (prisma as any).product.findMany({
        where: { active: true },
        include: { stocks: true }
    });

    let dashboardMissing = 0;
    let catalogMissing = 0;
    const diffs = [];

    for (const p of products) {
        const totalQty = p.stocks?.reduce((acc: number, s: any) => acc + Number(s.quantity), 0) || 0;
        const totalMin = p.stocks?.reduce((acc: number, s: any) => acc + Number(s.minStock || 0), 0) || Number(p.minStock || 0);

        const isDashed = totalQty <= 0 && totalMin > 0;
        if (isDashed) dashboardMissing++;

        const isCatalog = totalQty <= 0 && totalMin > 0;
        if (isCatalog) catalogMissing++;

        if (isDashed !== isCatalog) {
            diffs.push(p.name);
        }
    }

    console.log(`Resultados:`);
    console.log(`- Dashboard Missing Count: ${dashboardMissing}`);
    console.log(`- Catalog Missing Count: ${catalogMissing}`);
    console.log(`- Diferencias: ${diffs.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());


import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Analizando stock por producto y sucursal...");
    const stocks = await (prisma as any).stock.findMany({
        include: {
            product: { select: { name: true, code: true } },
            branch: { select: { name: true } }
        }
    });

    const summary: any = {};
    stocks.forEach((s: any) => {
        if (!summary[s.productId]) summary[s.productId] = { name: s.product.name, stocks: [] };
        summary[s.productId].stocks.push({ branch: s.branch.name, qty: Number(s.quantity) });
    });

    const problematic = Object.values(summary).filter((p: any) => p.stocks.length > 1);

    console.log(`Total productos con stock: ${Object.keys(summary).length}`);
    console.log(`Productos con stock en múltiples sucursales: ${problematic.length}`);

    if (problematic.length > 0) {
        console.log("\nEjemplos de productos duplicados en sucursales:");
        problematic.slice(0, 10).forEach((p: any) => {
            console.log(`- ${p.name}: ${JSON.stringify(p.stocks)}`);
        });
    }

    // Estadísticas de valores
    const totalQty = stocks.reduce((acc: number, s: any) => acc + Number(s.quantity), 0);
    console.log(`\nCantidad total de artículos en sistema: ${totalQty}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

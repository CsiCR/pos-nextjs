import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    const stats = await (prisma as any).product.findMany({
        where: { active: true },
        include: {
            stocks: true
        }
    });

    let criticalCount = 0;
    let lowStockCount = 0;

    stats.forEach((p: any) => {
        // Simplified dashboard logic for checking
        p.stocks.forEach((s: any) => {
            if (Number(s.quantity) === 0 && Number(s.minStock) > 0) {
                criticalCount++;
            } else if (Number(s.quantity) > 0 && Number(s.quantity) < Number(s.minStock)) {
                lowStockCount++;
            }
        });
    });

    console.log(`📊 Dashboard Stats:`);
    console.log(`- Alertas Críticas (Stock 0): ${criticalCount}`);
    console.log(`- Alertas Stock Bajo: ${lowStockCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());


import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Verificando stock actual...");
    const stocks = await (prisma as any).stock.findMany({
        include: { product: { select: { name: true } } }
    });

    console.log(`Total registros de stock: ${stocks.length}`);

    // Agrupar por producto
    const byProduct: any = {};
    stocks.forEach((s: any) => {
        if (!byProduct[s.productId]) byProduct[s.productId] = [];
        byProduct[s.productId].push(Number(s.quantity));
    });

    const productsWithDiffs = Object.entries(byProduct).filter(([id, values]: any) => {
        const first = values[0];
        return values.some((v: any) => v !== first);
    });

    if (productsWithDiffs.length === 0) {
        console.log("¡Éxito! Todos los productos tienen el mismo valor de stock en todas sus sucursales (ya sea 1 o más registros).");
    } else {
        console.log(`Atención: Aún hay ${productsWithDiffs.length} productos con valores inconsistentes entre sucursales.`);
        // Re-ejecutar corrección para esos específicos
        for (const [productId, values] of productsWithDiffs as any) {
            const minVal = Math.min(...values);
            await (prisma as any).stock.updateMany({
                where: { productId },
                data: { quantity: minVal }
            });
            console.log(`Corregido producto ID ${productId} a stock: ${minVal}`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());

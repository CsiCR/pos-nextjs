
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("--- Iniciando corrección de stock al valor mínimo ---");

    // Obtener todos los productos que tienen stock
    const stocks = await (prisma as any).stock.findMany();

    // Agrupar por producto para encontrar el mínimo
    const productStocks: any = {};
    stocks.forEach((s: any) => {
        if (!productStocks[s.productId]) productStocks[s.productId] = [];
        productStocks[s.productId].push(Number(s.quantity));
    });

    let count = 0;
    for (const productId in productStocks) {
        const values = productStocks[productId];
        const minVal = Math.min(...values);

        // Actualizar todos los registros de stock de ese producto al valor mínimo
        const result = await (prisma as any).stock.updateMany({
            where: { productId },
            data: { quantity: minVal }
        });

        count += result.count;
    }

    console.log(`--- Corrección finalizada. Se actualizaron ${count} registros de stock. ---`);
    console.log("Todos los productos ahora tienen como stock el valor mínimo que tenían registrado en sus sucursales.");
}

main().catch(console.error).finally(() => prisma.$disconnect());

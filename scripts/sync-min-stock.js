const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Iniciando sincronización de Stock Mínimo ---');

    // 1. Obtener todos los productos que tienen un minStock > 0 en la tabla Product
    const productsWithMinStock = await prisma.product.findMany({
        where: {
            minStock: { gt: 0 }
        }
    });

    console.log(`Se encontraron ${productsWithMinStock.length} productos con stock mínimo global.`);

    let updatedCount = 0;

    for (const product of productsWithMinStock) {
        const globalMinStock = product.minStock;

        // 2. Actualizar todos los registros de la tabla Stock para este producto 
        // donde el minStock sea 0 (no haya sido configurado localmente aún)
        const result = await prisma.stock.updateMany({
            where: {
                productId: product.id,
                minStock: 0 // Solo si está en 0 para no sobreescribir configuraciones manuales nuevas
            },
            data: {
                minStock: globalMinStock
            }
        });

        updatedCount += result.count;
        if (result.count > 0) {
            console.log(`Producto "${product.name}": Sincronizados ${result.count} registros de sucursal.`);
        }
    }

    console.log('--- Sincronización finalizada ---');
    console.log(`Total de registros de stock actualizados: ${updatedCount}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Iniciando actualización de Stock Mínimo ---');

    // 1. Obtener todas las categorías con su stock mínimo predeterminado
    const categories = await prisma.category.findMany({
        where: {
            defaultMinStock: { gt: 0 }
        }
    });

    console.log(`Se encontraron ${categories.length} categorías con stock mínimo configurado.`);

    for (const category of categories) {
        const defaultMin = category.defaultMinStock;
        console.log(`\nProcesando categoría: ${category.name} (Estandar: ${defaultMin})`);

        // 2. Actualizar stock mínimo en el modelo Product (Global) si es 0
        const updatedProducts = await prisma.product.updateMany({
            where: {
                categoryId: category.id,
                minStock: 0
            },
            data: {
                minStock: defaultMin
            }
        });

        if (updatedProducts.count > 0) {
            console.log(`  - ${updatedProducts.count} productos actualizados en su base global.`);
        }

        // 3. Actualizar stock mínimo en el modelo Stock (Sucursales) si es 0
        // Primero buscamos los productos de esta categoría para filtrar sus stocks
        const productsInCategory = await prisma.product.findMany({
            where: { categoryId: category.id },
            select: { id: true }
        });
        const productIds = productsInCategory.map(p => p.id);

        const updatedStocks = await prisma.stock.updateMany({
            where: {
                productId: { in: productIds },
                minStock: 0
            },
            data: {
                minStock: defaultMin
            }
        });

        if (updatedStocks.count > 0) {
            console.log(`  - ${updatedStocks.count} registros de sucursales actualizados.`);
        }
    }

    console.log('\n--- Actualización completada con éxito ---');
}

main()
    .catch((e) => {
        console.error('Error durante la ejecución:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Iniciando limpieza de productos mal importados ---');

    const products = await prisma.product.findMany({
        where: {
            active: false,
            OR: [
                { name: { startsWith: '"' } },
                { name: { endsWith: '"' } }
            ]
        }
    });

    console.log(`Se identificaron ${products.length} productos para eliminar.`);

    if (products.length === 0) {
        console.log('No hay productos para eliminar.');
        return;
    }

    const ids = products.map(p => p.id);

    try {
        // 1. Delete Stocks
        const deletedStocks = await prisma.stock.deleteMany({
            where: { productId: { in: ids } }
        });
        console.log(`- Registros de Stock eliminados: ${deletedStocks.count}`);

        // 2. Delete Prices
        const deletedPrices = await prisma.productPrice.deleteMany({
            where: { productId: { in: ids } }
        });
        console.log(`- Registros de Precios eliminados: ${deletedPrices.count}`);

        // 3. Delete Products (only if they have no sale items to be safe)
        const deletedProducts = await prisma.product.deleteMany({
            where: {
                id: { in: ids },
                saleItems: { none: {} }
            }
        });
        console.log(`- Productos eliminados permanentemente: ${deletedProducts.count}`);

        if (deletedProducts.count < ids.length) {
            console.warn(`ATENCIÓN: ${ids.length - deletedProducts.count} productos no se eliminaron porque podrían tener ventas asociadas.`);
        }

    } catch (error) {
        console.error('Error durante la eliminación:', error);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

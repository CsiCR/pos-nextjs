const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Iniciando PURGA TOTAL de productos inactivos sin ventas ---');

    const toDelete = await prisma.product.findMany({
        where: {
            active: false,
            saleItems: { none: {} }
        },
        select: { id: true, name: true }
    });

    console.log(`Se eliminarán permanentemente ${toDelete.length} productos.`);

    if (toDelete.length === 0) {
        console.log('Nada que purgar.');
        return;
    }

    const ids = toDelete.map(p => p.id);

    try {
        // 1. Delete Stocks
        const d1 = await prisma.stock.deleteMany({ where: { productId: { in: ids } } });
        console.log(`- Stocks eliminados: ${d1.count}`);

        // 2. Delete Prices
        const d2 = await prisma.productPrice.deleteMany({ where: { productId: { in: ids } } });
        console.log(`- Precios eliminados: ${d2.count}`);

        // 3. Delete Products
        const d3 = await prisma.product.deleteMany({ where: { id: { in: ids } } });
        console.log(`- Productos eliminados: ${d3.count}`);

        console.log('PURGA COMPLETADA EXITOSAMENTE.');
    } catch (error) {
        console.error('Error durante la purga:', error);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

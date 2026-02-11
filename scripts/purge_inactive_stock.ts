
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Iniciando limpieza de registros de stock obsoletos ---");

    // 1. Eliminar registros de stock que no tienen producto asociado (huérfanos)
    // Prisma usually handles this with cascades, but let's be safe.

    // 2. Eliminar registros de stock de productos INACTIVOS
    const inactiveProducts = await prisma.product.findMany({
        where: { active: false },
        select: { id: true }
    });
    const inactiveIds = inactiveProducts.map(p => p.id);

    if (inactiveIds.length > 0) {
        const res = await prisma.stock.deleteMany({
            where: {
                productId: { in: inactiveIds }
            }
        });
        console.log(`Eliminados ${res.count} registros de stock de productos inactivos.`);
    } else {
        console.log("No se encontraron productos inactivos con registros de stock.");
    }

    // 3. Eliminar registros de stock con cantidad 0 que NO sean de productos activos necesarios
    // (Opcional, pero mejor dejar solo lo necesario)

    console.log("--- Limpieza finalizada satisfactoriamente ---");
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());

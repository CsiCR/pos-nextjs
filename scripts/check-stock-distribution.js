const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Analizando Productos sin Distribución de Stock ---');

    // Buscar productos activos
    const products = await prisma.product.findMany({
        where: { active: true },
        include: {
            stocks: true,
            branch: true // Sucursal dueña si existe
        }
    });

    const discrepancies = [];

    for (const p of products) {
        const totalStock = p.stocks.reduce((sum, s) => sum + Number(s.quantity), 0);

        // Si el producto no tiene NINGÚN registro de stock
        if (p.stocks.length === 0) {
            discrepancies.push({
                id: p.id,
                name: p.name,
                code: p.code,
                reason: 'Sin registros en la tabla Stock',
                ownerBranch: p.branch?.name || 'Global'
            });
        } else if (totalStock === 0) {
            // Podría ser normal, pero lo listamos por si acaso
            // discrepancies.push({ id: p.id, name: p.name, total: 0, msg: 'Stock total es 0' });
        }
    }

    console.log(`\nProductos analizados: ${products.length}`);
    console.log(`Productos con discrepancias de distribución: ${discrepancies.length}\n`);

    if (discrepancies.length > 0) {
        console.table(discrepancies.map(d => ({
            Nombre: d.name,
            Código: d.code,
            Estado: d.reason,
            Dueño: d.ownerBranch
        })));
    } else {
        console.log('Todos los productos activos tienen al menos un registro de stock.');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Buscando Productos con Stock Global no Distribuido ---');

    // 1. Obtener todos los productos y sus stocks
    const products = await prisma.product.findMany({
        where: { active: true },
        include: {
            stocks: {
                include: { branch: true }
            }
        }
    });

    const list = [];

    for (const p of products) {
        const totalStock = p.stocks.reduce((sum, s) => sum + Number(s.quantity), 0);
        const branchesWithStock = p.stocks.filter(s => Number(s.quantity) > 0);

        // Definición de "No distribuido":
        // 1. Tiene stock total pero está en 0 sucursales? (Imposible matemáticamente)
        // 2. O quizás: tiene registros de stock pero la cantidad en cada una es 0?
        // 3. O quizás: tiene el campo legacy 'minStock' (que el usuario podría llamar stock global) > 0 pero cantidad 0?

        if (totalStock > 0 && branchesWithStock.length === 0) {
            // Esto no debería pasar con reduce, pero por si acaso
        }

        // Caso A: Productos con minStock global > 0 pero cantidad total 0
        if (Number(p.minStock) > 0 && totalStock === 0) {
            list.push({
                id: p.id,
                nombre: p.name,
                codigo: p.code,
                minStockGlobal: Number(p.minStock),
                stockTotal: totalStock,
                detalle: 'Tiene mínimo global pero 0 stock físico'
            });
        }

        // Caso B: Productos que tienen registros de stock en la tabla Stock pero todos están en 0
        // (Podría ser lo que el usuario quiere decir con "no distribuido" si esperaban que el stock inicial se aplicara)
        if (p.stocks.length > 0 && totalStock === 0) {
            // Solo si tienen un mínimo global
            if (Number(p.minStock) > 0) {
                // Ya está cubierto arriba
            }
        }
    }

    console.log(`\nProductos detectados: ${list.length}`);
    if (list.length > 0) {
        console.table(list.map(l => ({
            Producto: l.nombre,
            Cod: l.codigo,
            'Min. Global': l.minStockGlobal,
            'Stock Real': l.stockTotal,
            Obs: l.detalle
        })));
    } else {
        console.log('No se encontraron discrepancias obvias bajo estos criterios.');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

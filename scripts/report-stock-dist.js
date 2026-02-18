const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        where: { active: true },
        include: {
            stocks: { include: { branch: true } }
        }
    });

    const branches = await prisma.branch.findMany();

    console.log('--- REPORTE DE DISTRIBUCIÓN DE STOCK ---');

    const report = products.map(p => {
        const total = p.stocks.reduce((sum, s) => sum + Number(s.quantity), 0);
        const distribution = {};
        branches.forEach(b => {
            const s = p.stocks.find(st => st.branchId === b.id);
            distribution[b.name] = s ? Number(s.quantity) : 0;
        });

        return {
            Producto: p.name,
            Total: total,
            ...distribution
        };
    });

    // Filtrar solo los que tienen stock total > 0 para ver cómo están distribuidos
    const distributed = report.filter(r => r.Total > 0);

    // Buscar los que NO están distribuidos (por ejemplo, todo en una sola sucursal y 0 en el resto)
    const undistributed = distributed.filter(r => {
        const values = branches.map(b => r[b.name]);
        const branchesWithStock = values.filter(v => v > 0).length;
        return branchesWithStock === 1 && branches.length > 1;
    });

    console.log(`\nProductos con stock concentrado en una sola sucursal: ${undistributed.length}`);
    if (undistributed.length > 0) {
        console.table(undistributed.slice(0, 50));
    } else {
        console.log('Todos los productos con stock están distribuidos en 2 o más sucursales.');
    }

    // Ahora, lo que el usuario pidió: "tienen stock global y no esta distribuido"
    // Quizás se refieren a productos que el sistema CREE que tienen stock pero los registros de sucursal dicen 0?
    // Pero en este sistema el stock ES los registros de sucursal.

    // Salida final para el usuario
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

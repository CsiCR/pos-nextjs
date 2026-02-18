const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Identificando Discrepancias de Distribución ---');

    const products = await prisma.product.findMany({
        where: { active: true },
        include: {
            stocks: { include: { branch: true } }
        }
    });

    const discrepancies = [];

    for (const p of products) {
        const globalMin = Number(p.minStock);
        const branchMinSum = p.stocks.reduce((sum, s) => sum + Number(s.minStock), 0);
        const totalPhysicalStock = p.stocks.reduce((sum, s) => sum + Number(s.quantity), 0);

        // Definición 1: Tiene un mínimo global pero no tiene stock físico en ninguna sede
        if (globalMin > 0 && totalPhysicalStock === 0) {
            discrepancies.push({
                Nombre: p.name,
                Código: p.code,
                'Mínimo Global': globalMin,
                'Stock Físico Total': totalPhysicalStock,
                Observación: 'Tiene mínimo de alerta pero 0 unidades físicas'
            });
        }

        // Definición 2: El mínimo global es distinto a la suma de los mínimos locales 
        // (Esto indicaría un error de sincronización post-refactor)
        else if (globalMin > 0 && globalMin !== branchMinSum) {
            discrepancies.push({
                Nombre: p.name,
                Código: p.code,
                'Mínimo Global': globalMin,
                'Suma Mínimos Locales': branchMinSum,
                Observación: 'Discrepancia en límites de alerta (Global vs Sedes)'
            });
        }
    }

    console.log(`\nRegistros encontrados: ${discrepancies.length}\n`);
    if (discrepancies.length > 0) {
        console.table(discrepancies);
    } else {
        console.log('No se encontraron productos con stock global (mínimo) sin distribuir.');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

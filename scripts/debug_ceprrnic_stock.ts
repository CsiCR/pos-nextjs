
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const stocks = await prisma.stock.findMany({
        where: {
            branchId: 'cmlgyw6oi000xl804xjtksopx', // ID de Ceprrnic según diagnóstico previo
            quantity: { lte: 0 }
        },
        include: { product: true }
    });

    const active = stocks.filter(s => s.product && s.product.active);
    const inactive = stocks.filter(s => s.product && !s.product.active);
    const noProduct = stocks.filter(s => !s.product);

    console.log(`Total LTE 0 en Ceprrnic: ${stocks.length}`);
    console.log(`  - Vinculados a productos ACTIVOS: ${active.length}`);
    console.log(`  - Vinculados a productos INACTIVOS: ${inactive.length}`);
    console.log(`  - Sin producto vinculado (Huérfanos): ${noProduct.length}`);

    if (active.length > 0) {
        console.log('\nEjemplos de Activos en 0:');
        active.slice(0, 10).forEach(s => console.log(`  - ${s.product.name} [${s.product.code}]`));
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());

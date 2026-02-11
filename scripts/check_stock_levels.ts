
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const totalProds = await prisma.product.count({ where: { active: true } });
    const branches = await prisma.branch.findMany();

    console.log('Total Productos Activos:', totalProds);

    for (const b of branches) {
        const stockRecords = await prisma.stock.count({ where: { branchId: b.id } });
        const zeroOrLess = await prisma.stock.count({
            where: {
                branchId: b.id,
                quantity: { lte: 0 }
            }
        });
        const positive = await prisma.stock.count({
            where: {
                branchId: b.id,
                quantity: { gt: 0 }
            }
        });
        console.log(`Sucursal: ${b.name}`);
        console.log(`  - Total Records in Stock Table: ${stockRecords}`);
        console.log(`  - Quantity <= 0: ${zeroOrLess}`);
        console.log(`  - Quantity > 0: ${positive}`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());

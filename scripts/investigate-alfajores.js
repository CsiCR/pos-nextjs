const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Investigando Alfajores ---');

    const alfajores = await prisma.product.findMany({
        where: {
            name: { contains: 'ALFAJOR', mode: 'insensitive' }
        },
        include: {
            branch: true,
            stocks: true
        }
    });

    console.log(`Total encontrados: ${alfajores.length}`);

    alfajores.forEach(a => {
        console.log(`ID: ${a.id} | Nombre: ${a.name} | Active: ${a.active} | BranchOwner: ${a.branchId || 'GLOBAL'} | StocksRecords: ${a.stocks.length}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

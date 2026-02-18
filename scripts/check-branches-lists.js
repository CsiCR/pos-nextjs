const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- BRANCHES ---');
    const brs = await prisma.branch.findMany();
    brs.forEach(b => console.log(`ID: ${b.id} | Name: ${b.name} | Active: ${b.active}`));

    console.log('--- PRICE LISTS ---');
    const lists = await prisma.priceList.findMany();
    lists.forEach(l => console.log(`ID: ${l.id} | Name: ${l.name} | BranchId: ${l.branchId} | Active: ${l.active}`));
}

main().finally(() => prisma.$disconnect());

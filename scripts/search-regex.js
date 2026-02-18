const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        select: { name: true, active: true, code: true }
    });

    console.log('--- BUSCANDO FAN.*MINI ---');
    const regex = /FAN.*MINI/i;
    let found = 0;
    products.forEach(p => {
        if (regex.test(p.name)) {
            console.log(`[${p.active ? 'A' : 'I'}] | Code: ${p.code} | Name: ${p.name}`);
            found++;
        }
    });
    console.log(`Total encontrados: ${found}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

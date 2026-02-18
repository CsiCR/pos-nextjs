const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        where: {
            OR: [
                { name: { contains: 'FAN', mode: 'insensitive' } },
                { name: { contains: 'FON', mode: 'insensitive' } }
            ]
        }
    });

    console.log('--- BUSQUEDA FAN/FON ---');
    products.forEach(p => {
        console.log(`[${p.active ? 'A' : 'I'}] | Code: ${p.code} | Name: "${p.name}"`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        where: {
            OR: [
                { name: { contains: 'MINI TORTA', mode: 'insensitive' } },
                { name: { contains: 'MINITORTA', mode: 'insensitive' } }
            ]
        }
    });

    console.log('--- PRODUCTOS MINI TORTA ---');
    products.forEach(p => {
        console.log(`[${p.active ? 'A' : 'I'}] | Code: ${p.code} | Name: ${p.name}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        where: {
            OR: [
                { name: { contains: 'FAN', mode: 'insensitive' } },
                { name: { contains: 'MINI', mode: 'insensitive' } }
            ]
        },
        select: { name: true, active: true }
    });

    console.log('--- RESULTADOS ---');
    products.forEach(p => {
        console.log(`${p.active ? '[ACTIVE]' : '[INACTIVE]'} ${p.name}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

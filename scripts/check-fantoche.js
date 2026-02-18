const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Buscando Fantoche Mini ---');

    const products = await prisma.product.findMany({
        where: {
            name: { contains: 'FANTOCHE', mode: 'insensitive' }
        },
        include: {
            stocks: true,
            category: true
        }
    });

    console.log(JSON.stringify(products, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

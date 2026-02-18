const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        where: {
            name: { contains: 'COCA COLA' }
        },
        include: {
            stocks: { include: { branch: true } }
        }
    });

    console.log(JSON.stringify(products, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

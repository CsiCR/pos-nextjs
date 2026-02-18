const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        where: {
            name: { contains: 'ALF', mode: 'insensitive' }
        },
        select: { name: true, active: true, id: true }
    });

    products.forEach(p => {
        console.log(`${p.active ? '[ACTIVE]' : '[INACTIVE]'} ${p.name}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

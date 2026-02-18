const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Buscando productos que comiencen con FAN ---');

    const products = await prisma.product.findMany({
        where: {
            name: { contains: 'FAN', mode: 'insensitive' }
        },
        select: {
            id: true,
            name: true,
            active: true,
            minStock: true
        }
    });

    products.forEach(p => {
        console.log(`ID: ${p.id} | Name: ${p.name} | Active: ${p.active} | MinStock: ${p.minStock}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Buscando FAN y MINI ---');

    const products = await prisma.product.findMany({
        where: {
            OR: [
                { name: { contains: 'FAN', mode: 'insensitive' } },
                { name: { contains: 'MINI', mode: 'insensitive' } }
            ]
        },
        select: {
            id: true,
            name: true,
            active: true,
            minStock: true,
            stocks: { select: { quantity: true, branchId: true } }
        }
    });

    console.log(`Encontrados: ${products.length}`);
    products.forEach(p => {
        const totalStock = p.stocks.reduce((sum, s) => sum + Number(s.quantity), 0);
        console.log(`ID: ${p.id} | Active: ${p.active} | Stock: ${totalStock} | Name: ${p.name}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        where: {
            active: true,
            OR: [
                { name: { contains: 'MINI', mode: 'insensitive' } },
                { name: { contains: 'FAN', mode: 'insensitive' } }
            ]
        },
        include: {
            stocks: { include: { branch: true } }
        }
    });

    console.log('--- BUSQUEDA DETALLADA ---');
    products.forEach(p => {
        const stockInfo = p.stocks.map(s => `${s.branch.name}: ${s.quantity}`).join(' | ');
        console.log(`Code: ${p.code} | Name: ${p.name} | Stock: [${stockInfo || 'Sin Stock'}]`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

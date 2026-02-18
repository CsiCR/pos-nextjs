const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        where: {
            OR: [
                { name: { contains: 'FAN', mode: 'insensitive' } },
                { name: { contains: 'MINI', mode: 'insensitive' } }
            ]
        }
    });

    console.log('--- BUSQUEDA TOTAL (ACTIVE/INACTIVE) ---');
    products.forEach(p => {
        if (p.name.toUpperCase().includes('FAN') && p.name.toUpperCase().includes('MINI')) {
            console.log(`${p.active ? '[ACTIVE]' : '[INACTIVE]'} | Code: ${p.code} | Name: ${p.name}`);
        }
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

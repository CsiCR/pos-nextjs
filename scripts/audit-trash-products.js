const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Buscando productos mal importados (con comillas) ---');

    const products = await prisma.product.findMany({
        where: {
            active: false,
            OR: [
                { name: { startsWith: '"' } },
                { name: { endsWith: '"' } }
            ]
        },
        include: {
            _count: {
                select: {
                    saleItems: true,
                    stocks: true,
                    prices: true
                }
            }
        }
    });

    console.log(`Encontrados: ${products.length} productos.`);

    for (const p of products) {
        console.log(`ID: ${p.id} | Name: ${p.name}`);
        console.log(`  - Ventas: ${p._count.saleItems}`);
        console.log(`  - Registros de Stock: ${p._count.stocks}`);
        console.log(`  - Precios por lista: ${p._count.prices}`);
        console.log('-----------------------------------');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

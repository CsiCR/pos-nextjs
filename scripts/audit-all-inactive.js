const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Auditando segundo grupo de productos inactivos ---');

    const products = await prisma.product.findMany({
        where: { active: false },
        include: {
            _count: {
                select: {
                    saleItems: true
                }
            }
        }
    });

    console.log(`Encontrados en papelera: ${products.length} productos.`);

    for (const p of products) {
        if (p._count.saleItems === 0) {
            console.log(`[SEGURO PARA ELIMINAR] ID: ${p.id} | Name: ${p.name} | Code: ${p.code}`);
        } else {
            console.log(`[CONSERVANDO - TIENE VENTAS] ID: ${p.id} | Name: ${p.name} | Ventas: ${p._count.saleItems}`);
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const peritoId = 'cmlhepey10000jm04z28as2q5';

    console.log('--- Creando Lista de Precios para Perito Moreno ---');

    const existing = await prisma.priceList.findFirst({
        where: { branchId: peritoId }
    });

    if (!existing) {
        const newList = await prisma.priceList.create({
            data: {
                id: 'pl_perito',
                name: 'Ventas Perito Moreno',
                active: true,
                branchId: peritoId,
                percentage: 0
            }
        });
        console.log('Lista creada:', newList);

        // Opcional: Sincronizar precios base iniciales
        console.log('Sincronizando precios base...');
        const products = await prisma.product.findMany({ where: { active: true } });
        let count = 0;
        for (const p of products) {
            await prisma.productPrice.create({
                data: {
                    productId: p.id,
                    priceListId: 'pl_perito',
                    price: p.basePrice
                }
            });
            count++;
        }
        console.log(`Se inicializaron precios para ${count} productos en Perito Moreno.`);
    } else {
        console.log('La sucursal ya tiene una lista de precios:', existing.name);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

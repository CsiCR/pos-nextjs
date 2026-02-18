const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Iniciando sincronización de Precios por Sucursal ---');

    // 1. Obtener productos con precio base configurado
    const products = await prisma.product.findMany({
        where: {
            basePrice: { gt: 0 },
            active: true
        },
        select: { id: true, name: true, basePrice: true }
    });

    // 2. Obtener todas las listas de precios vinculadas a sucursales
    const priceLists = await prisma.priceList.findMany({
        where: { branchId: { not: null } }
    });

    console.log(`Productos base: ${products.length}. Listas de sucursales: ${priceLists.length}.`);

    let createdCount = 0;

    for (const product of products) {
        for (const list of priceLists) {
            // 3. Verificar si ya existe un precio para este producto en esta lista
            const existing = await prisma.productPrice.findUnique({
                where: {
                    productId_priceListId: {
                        productId: product.id,
                        priceListId: list.id
                    }
                }
            });

            if (!existing) {
                // 4. Si no existe, creamos el registro con el precio base global
                await prisma.productPrice.create({
                    data: {
                        productId: product.id,
                        priceListId: list.id,
                        price: product.basePrice
                    }
                });
                createdCount++;
            }
        }
    }

    console.log('--- Sincronización finalizada ---');
    console.log(`Total de precios de sucursal inicializados: ${createdCount}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

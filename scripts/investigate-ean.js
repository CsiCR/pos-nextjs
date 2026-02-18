const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const ean = '7798113302465';
    console.log(`Buscando EAN: ${ean}`);

    const p = await prisma.product.findFirst({
        where: { ean: ean }
    });

    if (p) {
        console.log('--- DETALLES DEL PRODUCTO ---');
        console.log(`ID: ${p.id}`);
        console.log(`Code: ${p.code}`);
        console.log(`EAN: ${p.ean}`);
        console.log(`Name: ${p.name}`);
        console.log(`Active: ${p.active}`);
        console.log(`Base Price: ${p.basePrice}`);
        console.log(`Updated At: ${p.updatedAt}`);

        const stocks = await prisma.stock.findMany({
            where: { productId: p.id },
            include: { branch: true }
        });
        console.log('--- STOCKS ---');
        stocks.forEach(s => {
            console.log(`Branch: ${s.branch.name} | Qty: ${s.quantity}`);
        });
    } else {
        console.log('Producto NO encontrado por EAN.');
    }
}

main().finally(() => prisma.$disconnect());

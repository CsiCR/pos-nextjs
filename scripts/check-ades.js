const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const p = await prisma.product.findFirst({
        where: { name: { contains: 'ADES MULTIFRUTAX200ML', mode: 'insensitive' } },
        include: { stocks: { include: { branch: true } } }
    });

    if (p) {
        console.log(`Producto: ${p.name}`);
        console.log(`Stock Global (Suma): ${p.stocks.reduce((acc, s) => acc + Number(s.quantity), 0)}`);
        console.log('--- Desglose por Sucursal ---');
        p.stocks.forEach(s => {
            console.log(`Sucursal: ${s.branch.name} | Cantidad: ${s.quantity}`);
        });
    } else {
        console.log('Producto no encontrado');
    }
}

main().finally(() => prisma.$disconnect());

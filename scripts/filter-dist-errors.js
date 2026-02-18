const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        where: { active: true },
        include: {
            stocks: true
        }
    });

    const list = products.filter(p => {
        const totalStock = p.stocks.reduce((sum, s) => sum + Number(s.quantity), 0);
        // Case 1: Has global minStock but 0 physical stock (no records or sum zero)
        return Number(p.minStock) > 0 && totalStock === 0;
    });

    console.log('--- PRODUCTOS CON MINIMO GLOBAL PERO 0 STOCK FISICO ---');
    list.forEach(p => {
        if (p.name.toUpperCase().includes('MINI') || p.name.toUpperCase().includes('FAN')) {
            console.log(`Code: ${p.code} | Name: ${p.name} | Stocks: ${p.stocks.length}`);
        }
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

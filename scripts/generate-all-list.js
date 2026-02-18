const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        where: {
            OR: [
                { name: { contains: 'ALF', mode: 'insensitive' } },
                { name: { contains: 'MINI', mode: 'insensitive' } }
            ]
        },
        select: { name: true, active: true, id: true, code: true }
    });

    const fs = require('fs');
    let content = '--- LISTADO COMPLETO ---\n';
    products.forEach(p => {
        content += `${p.active ? '[ACTIVE]' : '[INACTIVE]'} | Code: ${p.code} | Name: ${p.name}\n`;
    });
    fs.writeFileSync('all_alf_mini.txt', content);
    console.log('Archivo all_alf_mini.txt creado con ' + products.length + ' registros.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

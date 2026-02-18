const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Corrigiendo Nombres de Fantoche Mini ---');

    // 1. Encontrar productos que deberían ser Fantoche Mini pero no tienen la marca
    const products = await prisma.product.findMany({
        where: {
            OR: [
                { name: 'ALFAJOR MINI TORTA BLANCO' },
                { name: 'ALFAJOR MINI TORTA NEGRO' },
                { name: { contains: 'MINI TORTA', mode: 'insensitive' }, NOT: { name: { contains: 'FANTOCHE', mode: 'insensitive' } } }
            ]
        }
    });

    for (const p of products) {
        // Solo actualizamos si no tiene Fantoche o Rapsodia/Aguila
        if (!p.name.toUpperCase().includes('FANTOCHE') &&
            !p.name.toUpperCase().includes('AGUILA') &&
            !p.name.toUpperCase().includes('RAPSODIA')) {

            const newName = `ALFAJOR FANTOCHE ${p.name.replace(/ALFAJOR /i, '')}`;
            console.log(`Actualizando: "${p.name}" -> "${newName}"`);

            await prisma.product.update({
                where: { id: p.id },
                data: { name: newName }
            });
        }
    }

    console.log('Sincronización de nombres completada.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

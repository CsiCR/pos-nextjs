const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Estructura Raw de la Tabla Product ---');

    const columns = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Product';
  `;

    console.table(columns);

    console.log('\n--- Buscando campos con valores sospechosos ---');
    // Buscar cualquier columna que tenga "stock" o "quantity" en su nombre y ver sus valores
    // Pero ya listamos las columnas arriba.

    const sample = await prisma.$queryRaw`SELECT * FROM "Product" LIMIT 5`;
    console.log('\nSample data (JSON):');
    console.log(JSON.stringify(sample, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

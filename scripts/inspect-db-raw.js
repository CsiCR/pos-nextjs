const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, udt_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'CustomerTransaction'
    `;
    console.log('--- COLUMNS ---');
    result.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type} (${row.udt_name}) ${row.is_nullable}`);
    });

    const enums = await prisma.$queryRaw`
      SELECT t.typname as enum_name, e.enumlabel as enum_value
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid
    `;
    console.log('\n--- ENUMS ---');
    enums.forEach(row => {
      console.log(`${row.enum_name}: ${row.enum_value}`);
    });
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();

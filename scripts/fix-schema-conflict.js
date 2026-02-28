const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Converting CustomerTransaction.type to text...');
        await prisma.$executeRawUnsafe(`
      ALTER TABLE "CustomerTransaction" 
      ALTER COLUMN "type" TYPE text 
      USING "type"::text;
    `);

        console.log('Dropping CustomerTransactionType enum...');
        await prisma.$executeRawUnsafe(`
      DROP TYPE IF EXISTS "CustomerTransactionType";
    `);

        console.log('Done! Ready for prisma db push.');
    } catch (e) {
        console.error('Error fixing schema:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();

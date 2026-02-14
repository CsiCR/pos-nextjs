const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const rivadaviaId = "cmkttrw6w0001vdrghk0p06mn";
    const cepernicId = "cmlgyw6oi000xl804xjtksopx";

    console.log("Creando/Actualizando listas de precios por sucursal via SQL Raw...");

    try {
        // Create Rivadavia list if not exists
        await prisma.$executeRaw`
      INSERT INTO "PriceList" ("id", "name", "percentage", "active", "branchId")
      VALUES ('pl_rivadavia', 'Ventas Rivadavia', 0, true, ${rivadaviaId})
      ON CONFLICT ("name") DO UPDATE SET "branchId" = ${rivadaviaId}
    `;

        // Create Cepernic list if not exists
        await prisma.$executeRaw`
      INSERT INTO "PriceList" ("id", "name", "percentage", "active", "branchId")
      VALUES ('pl_cepernic', 'Ventas Cepernic', 0, true, ${cepernicId})
      ON CONFLICT ("name") DO UPDATE SET "branchId" = ${cepernicId}
    `;

        console.log("Listas creadas exitosamente.");
    } catch (e) {
        console.error("Error al insertar listas:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();

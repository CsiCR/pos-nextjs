const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function debug() {
    try {
        const priceLists = await prisma.$queryRaw`SELECT id, name, "branchId" FROM "PriceList"`;
        console.log("--- LISTAS DE PRECIOS (RAW) ---");
        console.log(priceLists);

        const users = await prisma.user.findMany({ select: { name: true, role: true, branchId: true } });
        console.log("\n--- USUARIOS ---");
        console.log(users);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

debug();

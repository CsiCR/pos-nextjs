const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function debug() {
    console.log("--- USUARIOS Y ROLES ---");
    const users = await prisma.user.findMany({
        select: { id: true, name: true, role: true, branchId: true }
    });
    console.table(users);

    console.log("\n--- SUCURSALES ---");
    const branches = await prisma.branch.findMany();
    console.table(branches);

    console.log("\n--- LISTAS DE PRECIOS ---");
    const priceLists = await prisma.priceList.findMany({
        include: { branch: true }
    });
    console.log(priceLists.map(l => ({
        id: l.id,
        name: l.name,
        branchId: l.branchId,
        branchName: l.branch?.name || "GLOBAL"
    })));
}

debug().catch(console.error).finally(() => prisma.$disconnect());

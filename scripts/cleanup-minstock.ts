import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    console.log("🚀 Iniciando limpieza masiva de Stock Mínimo...");

    // 1. Buscar registros que necesitan corrección
    const stockRecords = await (prisma as any).stock.findMany({
        where: {
            quantity: 0,
            minStock: { gt: 0 }
        },
        include: {
            product: true,
            branch: true
        }
    });

    console.log(`🔍 Se encontraron ${stockRecords.length} registros con Stock 0 pero Mínimo > 0.`);

    if (stockRecords.length === 0) {
        console.log("✅ No hay nada que limpiar.");
        return;
    }

    // 2. Ejecutar actualización masiva
    const updateResult = await (prisma as any).stock.updateMany({
        where: {
            quantity: 0,
            minStock: { gt: 0 }
        },
        data: {
            minStock: 0
        }
    });

    console.log(`✨ Se actualizaron ${updateResult.count} registros exitosamente.`);
    console.log("Detalle de algunos cambios:");
    stockRecords.slice(0, 5).forEach((s: any) => {
        console.log(`- [${s.branch.name}] ${s.product.name}: Mínimo ${s.minStock} -> 0`);
    });
}

main()
    .catch((e) => {
        console.error("❌ Error durante la limpieza:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

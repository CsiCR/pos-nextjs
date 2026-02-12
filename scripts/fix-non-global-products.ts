import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🔍 Buscando productos con sucursal asignada (no globales)...");

    const nonGlobalProducts = await prisma.product.findMany({
        where: {
            branchId: { not: null }
        },
        select: {
            id: true,
            name: true,
            branchId: true
        }
    });

    console.log(`📊 Se encontraron ${nonGlobalProducts.length} productos que no son globales.`);

    if (nonGlobalProducts.length > 0) {
        console.log("Primeros 5 productos encontrados:");
        nonGlobalProducts.slice(0, 5).forEach(p => console.log(`- ${p.name} (Sucursal ID: ${p.branchId})`));

        console.log("\n🚀 Convirtiendo todos los productos a globales (branchId: null)...");

        const result = await prisma.product.updateMany({
            where: {
                branchId: { not: null }
            },
            data: {
                branchId: null
            }
        });

        console.log(`✨ Éxito: Se globalizaron ${result.count} productos.`);
    } else {
        console.log("✅ Todos los productos ya son globales.");
    }
}

main()
    .catch((e) => {
        console.error("❌ Error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

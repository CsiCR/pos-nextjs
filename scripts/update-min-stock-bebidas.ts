import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🔍 Buscando categoría 'Bebidas'...");

    const category = await prisma.category.findFirst({
        where: {
            name: {
                contains: "bebida",
                mode: "insensitive"
            }
        }
    });

    if (!category) {
        console.error("❌ No se encontró la categoría 'Bebidas'.");
        return;
    }

    console.log(`✅ Categoría encontrada: ${category.name} (ID: ${category.id})`);
    console.log("🚀 Actualizando stock mínimo a 6 para todos los productos de esta categoría...");

    const updateResult = await prisma.product.updateMany({
        where: {
            categoryId: category.id
        },
        data: {
            minStock: 6
        }
    });

    console.log(`✨ Proceso completado. Se actualizaron ${updateResult.count} productos.`);
}

main()
    .catch((e) => {
        console.error("❌ Error ejecutando el script:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

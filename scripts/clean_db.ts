
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function cleanName(name: string): string {
    if (!name) return name;
    // Eliminar comillas al principio y al final, y espacios extra
    return name.trim().replace(/^"|"$/g, '').trim();
}

async function main() {
    console.log("--- Iniciando limpieza de inconsistencias ---");

    // 1. Limpiar Categorías
    const categories = await prisma.category.findMany();
    const catUpdates = [];

    for (const cat of categories) {
        const cleaned = cleanName(cat.name);
        if (cleaned !== cat.name) {
            console.log(`Categoría: "${cat.name}" -> "${cleaned}"`);

            // Verificar si ya existe una categoría con el nombre limpio
            const existing = await prisma.category.findFirst({
                where: { name: cleaned }
            });

            if (existing && existing.id !== cat.id) {
                console.log(`Fusionando "${cat.name}" con la existente "${cleaned}"...`);
                // Mover productos de la categoría con comillas a la limpia
                await prisma.product.updateMany({
                    where: { categoryId: cat.id },
                    data: { categoryId: existing.id }
                });
                // Eliminar la categoría duplicada
                await prisma.category.delete({ where: { id: cat.id } });
            } else {
                // Simplemente renombrar
                await prisma.category.update({
                    where: { id: cat.id },
                    data: { name: cleaned }
                });
            }
        }
    }

    // 2. Limpiar Unidades de Medida
    const units = await prisma.measurementUnit.findMany();
    for (const unit of units) {
        const cleanedName = cleanName(unit.name);
        const cleanedSymbol = cleanName(unit.symbol);
        if (cleanedName !== unit.name || cleanedSymbol !== unit.symbol) {
            console.log(`Unidad: "${unit.name}" (${unit.symbol}) -> "${cleanedName}" (${cleanedSymbol})`);
            await prisma.measurementUnit.update({
                where: { id: unit.id },
                data: { name: cleanedName, symbol: cleanedSymbol }
            }).catch(e => console.error(`Error actualizando unidad ${unit.id}:`, e.message));
        }
    }

    // 3. Limpiar Productos (Nombres y EANs)
    const products = await prisma.product.findMany();
    for (const p of products) {
        const cleanedName = cleanName(p.name);
        const cleanedEan = p.ean ? cleanName(p.ean) : null;

        if (cleanedName !== p.name || (cleanedEan !== p.ean)) {
            console.log(`Producto: [${p.code}] "${p.name}" -> "${cleanedName}"`);
            await prisma.product.update({
                where: { id: p.id },
                data: {
                    name: cleanedName,
                    ean: cleanedEan
                }
            }).catch(e => console.error(`Error actualizando producto ${p.id}:`, e.message));
        }
    }

    console.log("--- Limpieza finalizada satisfactoriamente ---");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

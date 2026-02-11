
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Convirtiendo todos los productos a Globales (sin sucursal propietaria)...");
    const res = await (prisma as any).product.updateMany({
        data: { branchId: null }
    });
    console.log(`Total de productos actualizados: ${res.count}`);
    console.log("Ahora todos los supervisores deberían ver el catálogo completo.");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

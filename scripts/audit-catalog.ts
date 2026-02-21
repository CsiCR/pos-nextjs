import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const prisma = new PrismaClient();

async function main() {
    console.log("Generando auditoría del catálogo...");

    const products = await prisma.product.findMany({
        include: {
            category: true,
            baseUnit: true,
            branch: true,
            stocks: {
                include: { branch: true }
            },
            prices: {
                include: { priceList: true }
            }
        }
    });

    const branches = await prisma.branch.findMany();

    const csvRows: string[] = [];
    // Cabecera
    csvRows.push([
        "ID",
        "Estado",
        "Codigo",
        "EAN",
        "Nombre",
        "Unidad",
        "Categoria",
        "Precio Base (Global)",
        "Minimo (Global)",
        "Sucursal Dueña",
        "Sucursal (Stock/Precio)",
        "Stock Actual (Sucursal)",
        "Stock Minimo (Sucursal)",
        "Precio Venta (Sucursal)",
        "Diferencia Precio"
    ].join(","));

    for (const p of products) {
        // Encontrar sucursales que tienen algo configurado para este producto
        const relevantBranchIds = new Set([
            ...p.stocks.map(s => s.branchId),
            ...p.prices.map(pr => pr.priceList.branchId),
            p.branchId // Incluir la sucursal dueña si existe
        ].filter(Boolean));

        // Si no tiene nada en ninguna sucursal (raro), podrías querer ver una fila general
        if (relevantBranchIds.size === 0) {
            relevantBranchIds.add(null);
        }

        for (const branchId of relevantBranchIds) {
            const b = branches.find(br => br.id === branchId);
            const stock = p.stocks.find(s => s.branchId === branchId);
            const price = p.prices.find(pr => pr.priceList.branchId === branchId);

            const row = [
                p.id,
                p.active ? "Activo" : "Inactivo",
                `"${p.code}"`,
                `"${p.ean || ""}"`,
                `"${p.name.replace(/"/g, '""')}"`,
                p.baseUnit?.symbol || "-",
                `"${p.category?.name || "General"}"`,
                p.basePrice.toString(),
                (p.minStock || 0).toString(),
                `"${p.branch?.name || "Global"}"`,
                b ? `"${b.name}"` : "Global (Sin Stock Local)",
                (stock?.quantity || 0).toString(),
                (stock?.minStock || 0).toString(), // NO fallback. Si no hay record, el min de ESA sucursal es 0.
                (price?.price || p.basePrice).toString(),
                (Number(price?.price || p.basePrice) - Number(p.basePrice)).toString()
            ];
            csvRows.push(row.join(","));
        }
    }

    fs.writeFileSync("auditoria_catalogo_v2.csv", "\uFEFF" + csvRows.join("\n"));
    console.log("¡Hecho! Archivo 'auditoria_catalogo_v2.csv' generado.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

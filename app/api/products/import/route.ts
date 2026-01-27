export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { Prisma } from "@prisma/client";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const userRole = (session?.user as any)?.role;
        if (!session || (userRole !== "SUPERVISOR" && userRole !== "ADMIN" && userRole !== "GERENTE")) {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        }

        const branchId = (session.user as any).branchId;

        // Validate branchId if strictly required (optional based on your logic, but safe to check type)
        let targetBranchId = branchId;

        // Fallback for Admin: If no branch assigned to user, try to find the first available branch to put stock in.
        if (!targetBranchId && (userRole === "ADMIN" || userRole === "GERENTE")) {
            const firstBranch = await (prisma as any).branch.findFirst();
            if (firstBranch) targetBranchId = firstBranch.id;
        }

        if (targetBranchId) {
            const branchExists = await (prisma as any).branch.findUnique({ where: { id: targetBranchId } });
            if (!branchExists) {
                return NextResponse.json({ error: "Error de Sesión: La sucursal no existe. Por favor, cierra sesión y vuelve a ingresar." }, { status: 400 });
            }
        }

        const productsToImport = await req.json();
        if (!Array.isArray(productsToImport)) {
            return NextResponse.json({ error: "Formato inválido. Se espera un array de productos." }, { status: 400 });
        }

        // --- OPTIMIZATION START ---
        // 1. Pre-fetch Categories and Units to avoid N+1 queries
        const allCategories = await (prisma as any).category.findMany();
        const catMap = new Map(allCategories.map((c: any) => [c.name.toLowerCase(), c.id]));

        const allUnits = await (prisma as any).measurementUnit.findMany();
        const unitMap = new Map(allUnits.map((u: any) => [u.symbol.toLowerCase(), u.id]));

        // 2. Pre-fetch Potential Existing Products (by Code or EAN) to avoid N+1 queries
        // Extract all codes and EANs from input
        const codesToCheck = productsToImport.map((p: any) => p.codigo ? String(p.codigo).trim() : null).filter(Boolean);
        const eansToCheck = productsToImport.map((p: any) => p.ean ? String(p.ean).trim() : null).filter(Boolean);

        const existingProductsRaw = await (prisma as any).product.findMany({
            where: {
                OR: [
                    { code: { in: codesToCheck } },
                    { ean: { in: eansToCheck } }
                ]
            },
            include: { branch: true } // Need branch to check ownership
        });

        const productByCode = new Map<string, any>(existingProductsRaw.map((p: any) => [p.code, p]));
        const productByEan = new Map<string, any>(existingProductsRaw.filter((p: any) => p.ean).map((p: any) => [p.ean, p]));
        // --- OPTIMIZATION END ---

        const results = await (prisma as any).$transaction(async (tx: any) => {
            const imported = [];
            const warnings = [];

            for (const [index, p] of productsToImport.entries()) {
                const rowNum = index + 1; // 1-based index for user friendliness
                if (!p.nombre) {
                    warnings.push({ row: rowNum, name: "Desconocido", issue: "Fila omitida por falta de nombre" });
                    continue;
                }

                // 1. Handle Category (Optimized)
                let categoryId = null;
                const categoryInput = p.categoria ? String(p.categoria).trim() : "No Asignada";
                const catKey = categoryInput.toLowerCase();

                if (catMap.has(catKey)) {
                    categoryId = catMap.get(catKey);
                } else {
                    // Create and update cache
                    const formattedName = categoryInput.charAt(0).toUpperCase() + categoryInput.slice(1).toLowerCase();
                    const newCat = await tx.category.create({ data: { name: formattedName } });
                    catMap.set(catKey, newCat.id);
                    categoryId = newCat.id;
                }

                // 2. Handle Unit (Optimized)
                let unitId = null;
                const unitSymbolInput = (p.unidad ? String(p.unidad).trim() : 'un');
                const unitKey = unitSymbolInput.toLowerCase();

                if (unitMap.has(unitKey)) {
                    unitId = unitMap.get(unitKey);
                } else {
                    // Create and update cache
                    const isBase = unitKey === 'un' || unitKey === 'kg';
                    const newUnit = await tx.measurementUnit.create({
                        data: {
                            name: unitSymbolInput.toUpperCase(),
                            symbol: unitSymbolInput,
                            isBase: isBase
                        }
                    });
                    unitMap.set(unitKey, newUnit.id);
                    unitId = newUnit.id;
                }

                // 3. Resolve Product Code & Identity (Optimized)
                const codeInput = (p.codigo && String(p.codigo).trim() !== "") ? String(p.codigo).trim() : null;
                const eanInput = p.ean && String(p.ean).trim() !== "" ? String(p.ean).trim() : null;

                let product = null;

                // A. Check by Code
                if (codeInput && productByCode.has(codeInput)) {
                    product = productByCode.get(codeInput);
                }

                // B. Check by EAN
                if (!product && eanInput && productByEan.has(eanInput)) {
                    const eanMatch = productByEan.get(eanInput);

                    // SMART MERGE CHECK logic
                    const existingName = (eanMatch.name || "").toLowerCase().trim();
                    const incomingName = (p.nombre || "").toLowerCase().trim();
                    const isSimilar = existingName.includes(incomingName) || incomingName.includes(existingName);

                    if (isSimilar) {
                        product = eanMatch;
                    } else {
                        // Conflict detected
                        // Note: We don't push warning here because strict collision check comes later.
                        // But we know we can't use this product.
                    }
                }

                // Safe Number Parsing
                let basePrice = 0;
                if (p.precio) {
                    const sanitizedPrice = String(p.precio).replace(",", ".");
                    const parsed = parseFloat(sanitizedPrice);
                    if (!isNaN(parsed)) basePrice = parsed;
                }

                let stockQty = 0;
                if (p.stock) {
                    const sanitizedStock = String(p.stock).replace(",", ".");
                    const parsed = parseFloat(sanitizedStock);
                    if (!isNaN(parsed)) stockQty = parsed;
                }

                // Min Stock parsing
                let minStock = 0;
                const minStockRaw = p.minStock || p["stock minimo"] || p["stock_minimo"] || p["minimo"];
                if (minStockRaw) {
                    const sanitizedMin = String(minStockRaw).replace(",", ".");
                    const parsedMin = parseFloat(sanitizedMin);
                    if (!isNaN(parsedMin)) minStock = parsedMin;
                }

                const commonData: any = {
                    name: p.nombre,
                    basePrice: basePrice,
                    category: categoryId ? { connect: { id: categoryId } } : undefined,
                    baseUnit: unitId ? { connect: { id: unitId } } : undefined,
                    minStock: minStock,
                    active: true
                };

                let productCode = codeInput || `INT${Date.now()}${Math.floor(Math.random() * 1000)}`;

                if (product) {
                    // --- UPDATE PATH ---

                    // Handle EAN update
                    if (eanInput && product.ean !== eanInput) {
                        if (productByEan.has(eanInput) && productByEan.get(eanInput).id !== product.id) {
                            const collision = productByEan.get(eanInput);
                            warnings.push({ row: rowNum, name: p.nombre, issue: `No se pudo actualizar EAN a ${eanInput} porque ya lo usa "${collision.name}".` });
                        } else {
                            commonData.ean = eanInput;
                            // Update cache effectively for next iterations? complex, skipping deep cache update for now
                        }
                    } else if (eanInput) {
                        // Ean matches current, or is null
                        commonData.ean = eanInput;
                    }

                    // Branch Ownership
                    if (product.branchId === null && branchId) {
                        commonData.branch = { connect: { id: branchId } };
                    }

                    try {
                        product = await tx.product.update({
                            where: { id: product.id },
                            data: commonData
                        });
                        // Update in-memory map for next iterations in same batch? 
                        // Maybe not strictly necessary if CSV doesn't duplicate rows often.
                    } catch (e) {
                        throw e;
                    }
                } else {
                    // --- CREATE PATH ---

                    // EAN Uniqueness Check (Global-ish within batch context + DB)
                    let finalEan = eanInput;
                    if (finalEan && productByEan.has(finalEan)) {
                        const collision = productByEan.get(finalEan);
                        // If we are here, it means we didn't match 'product' above (smart merge failed or different code).
                        warnings.push({
                            row: rowNum,
                            name: p.nombre,
                            issue: `Conflicto EAN ${finalEan} con "${collision.name}". Se creó como producto nuevo (sin EAN).`
                        });
                        finalEan = null;
                    }
                    commonData.ean = finalEan;

                    try {
                        product = await tx.product.create({
                            data: {
                                code: productCode,
                                branch: branchId ? { connect: { id: branchId } } : undefined,
                                ...commonData
                            }
                        });

                        // Update caches for subsequent rows in this same batch
                        if (product.code) productByCode.set(product.code, product);
                        if (product.ean) productByEan.set(product.ean, product);

                    } catch (e: any) {
                        warnings.push({ row: rowNum, name: p.nombre, issue: "Error crítico al crear producto: " + e.message });
                        continue;
                    }
                }

                // 4. Update Stock
                if (targetBranchId) {
                    await tx.stock.upsert({
                        where: {
                            productId_branchId: {
                                productId: product.id,
                                branchId: targetBranchId
                            }
                        },
                        update: { quantity: { increment: stockQty } },
                        create: {
                            productId: product.id,
                            branchId: targetBranchId,
                            quantity: stockQty
                        }
                    });
                }
                imported.push(product.id);
            }

            return { imported, warnings };
        }, {
            maxWait: 20000,
            timeout: 120000
        });

        return NextResponse.json({ success: true, count: results.imported.length, warnings: results.warnings });
    } catch (error: any) {
        console.error("DEBUG IMPORT ERROR:", JSON.stringify(error, null, 2));

        // Enhanced logging for Prisma Validation Errors
        if (error instanceof Prisma.PrismaClientValidationError) {
            console.error("Prisma Validation Error Message:", error.message);
        }

        return NextResponse.json({ error: error.message || "Error al importar productos", details: error }, { status: 500 });
    }
}

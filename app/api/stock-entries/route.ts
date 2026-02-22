import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const data = await req.json();
        const { branchId, supplierName, invoiceNumber, totalAmount, items, updateBasePrices, invoiceUrl, notes } = data;

        if (!branchId || !items || !items.length) {
            return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create the Stock Entry record
            const entry = await (tx as any).stockEntry.create({
                data: {
                    branchId,
                    supplierName,
                    invoiceNumber,
                    invoiceUrl,
                    totalAmount: totalAmount ? Number(totalAmount) : null,
                    notes,
                    createdById: session.user.id,
                    items: {
                        create: items.map((item: any) => ({
                            productId: item.productId,
                            quantity: Number(item.quantity),
                            costPrice: Number(item.costPrice)
                        }))
                    }
                },
                include: {
                    items: true
                }
            });

            // 2. Update Stock and optionally Base Prices
            for (const item of items) {
                // Update Stock in the target branch
                await (tx as any).stock.upsert({
                    where: {
                        productId_branchId: {
                            productId: item.productId,
                            branchId
                        }
                    },
                    update: {
                        quantity: { increment: Number(item.quantity) }
                    },
                    create: {
                        productId: item.productId,
                        branchId,
                        quantity: Number(item.quantity)
                    }
                });

                // Update product base price if requested
                if (updateBasePrices && item.updatePrice) {
                    await (tx as any).product.update({
                        where: { id: item.productId },
                        data: { basePrice: Number(item.costPrice) }
                    });
                }
            }

            return entry;
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error saving stock entry:", error);
        return NextResponse.json({ error: "Error al guardar el ingreso" }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const branchId = searchParams.get("branchId");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const page = parseInt(searchParams.get("page") || "1");
        const pageSize = parseInt(searchParams.get("pageSize") || "100");
        const skip = (page - 1) * pageSize;

        const where: any = { AND: [] };
        if (branchId) where.AND.push({ branchId });

        if (startDate || endDate) {
            const { getZonedStartOfDay, getZonedEndOfDay } = require("@/lib/utils");
            const dateRange: any = {};
            if (startDate) dateRange.gte = getZonedStartOfDay(startDate);
            if (endDate) dateRange.lte = getZonedEndOfDay(endDate);
            where.AND.push({ createdAt: dateRange });
        }

        const totalEntries = await prisma.stockEntry.count({ where });

        const entries = await (prisma as any).stockEntry.findMany({
            where,
            include: {
                branch: { select: { name: true } },
                createdBy: { select: { name: true } },
                items: {
                    include: {
                        product: { select: { name: true, code: true } }
                    }
                }
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize
        });

        return NextResponse.json({
            entries,
            pagination: {
                total: totalEntries,
                pages: Math.ceil(totalEntries / pageSize),
                currentPage: page,
                pageSize
            }
        });
    } catch (error) {
        console.error("Error fetching stock entries:", error);
        return NextResponse.json({ error: "Error al cargar los ingresos" }, { status: 500 });
    }
}

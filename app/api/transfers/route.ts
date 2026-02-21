export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const userRole = (session?.user as any)?.role;
        const userBranchId = (session?.user as any)?.branchId;
        const { searchParams } = new URL(req.url);
        const branchId = searchParams.get("branchId") || userBranchId;
        const status = searchParams.get("status");

        // Check if module is enabled
        const settings = (await prisma.systemSetting.findUnique({ where: { key: "global" } })) as any;
        if (settings && !settings.isClearingEnabled && userRole !== "ADMIN") {
            return NextResponse.json({ error: "El módulo de Clearing está desactivado" }, { status: 403 });
        }

        const where: any = {};
        if (userRole === "SUPERVISOR" || userRole === "CAJERO") {
            where.OR = [
                { sourceBranchId: userBranchId },
                { targetBranchId: userBranchId }
            ];
        } else if (branchId) {
            where.OR = [
                { sourceBranchId: branchId },
                { targetBranchId: branchId }
            ];
        }

        if (status) {
            where.status = status;
        }

        const transfers = await (prisma as any).stockTransfer.findMany({
            where,
            include: {
                sourceBranch: true,
                targetBranch: true,
                createdBy: { select: { name: true } },
                shippedBy: { select: { name: true } },
                confirmedBy: { select: { name: true } },
                items: {
                    include: {
                        product: true
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json(transfers);
    } catch (error) {
        console.error("Error fetching transfers:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

        const data = await req.json();
        const { sourceBranchId, targetBranchId, items, notes } = data;

        if (!sourceBranchId || !targetBranchId || !items || !items.length) {
            return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
        }

        // Check if module is enabled
        const settings = (await prisma.systemSetting.findUnique({ where: { key: "global" } })) as any;
        if (settings && !settings.isClearingEnabled) {
            return NextResponse.json({ error: "El módulo de Clearing está desactivado" }, { status: 403 });
        }

        const transfer = await (prisma as any).stockTransfer.create({
            data: {
                sourceBranchId,
                targetBranchId,
                notes,
                createdById: session.user.id,
                status: "PENDIENTE",
                items: {
                    create: items.map((item: any) => ({
                        productId: item.productId,
                        quantity: Number(item.quantity)
                    }))
                }
            },
            include: {
                items: true
            }
        });

        return NextResponse.json(transfer);
    } catch (error) {
        console.error("Error creating transfer:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}

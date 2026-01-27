export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// POST: Create a new Settlement (Payment)
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { targetBranchId, amount, notes } = await req.json();
    const sourceBranchId = (session.user as any).branchId;

    if (!sourceBranchId) return NextResponse.json({ error: "User has no branch" }, { status: 400 });

    try {
        const settlement = await prisma.settlement.create({
            data: {
                amount: Number(amount),
                sourceBranchId,
                targetBranchId,
                notes,
                createdById: session.user.id,
                status: "PENDING"
            }
        });
        return NextResponse.json(settlement);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT: Confirm or Reject a Settlement
export async function PUT(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, status } = await req.json(); // status: CONFIRMED | REJECTED
    const userBranchId = (session.user as any).branchId;

    try {
        const settlement = await prisma.settlement.findUnique({ where: { id } });
        if (!settlement) return NextResponse.json({ error: "Not found" }, { status: 404 });

        // Security Check: Only the TARGET branch can confirm/reject reception
        // Or ADMIN
        const isAdmin = (session.user as any).role === "ADMIN" || (session.user as any).role === "GERENTE";
        if (settlement.targetBranchId !== userBranchId && !isAdmin) {
            return NextResponse.json({ error: "Forbidden: You are not the recipient" }, { status: 403 });
        }

        const updated = await prisma.settlement.update({
            where: { id },
            data: {
                status,
                confirmedById: session.user.id
            }
        });
        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// GET: List settlements (History/Pending)
export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode"); // "incoming" | "outgoing"
    const userBranchId = (session.user as any).branchId;

    const where: any = {};
    if (mode === "incoming") {
        where.targetBranchId = userBranchId;
    } else if (mode === "outgoing") {
        where.sourceBranchId = userBranchId;
    } else {
        // All related
        where.OR = [{ sourceBranchId: userBranchId }, { targetBranchId: userBranchId }];
    }

    const settlements = await prisma.settlement.findMany({
        where,
        include: {
            sourceBranch: { select: { name: true } },
            targetBranch: { select: { name: true } },
            createdBy: { select: { name: true } }
        },
        orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(settlements);
}

export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET() {
    try {
        let settings = await prisma.systemSetting.findUnique({
            where: { key: "global" }
        });

        if (!settings) {
            settings = await prisma.systemSetting.create({
                data: {
                    key: "global",
                    useDecimals: true
                }
            });
        }

        return NextResponse.json(settings);
    } catch (error) {
        return NextResponse.json({ error: "Error loading settings" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const settings = await prisma.systemSetting.upsert({
            where: { key: "global" },
            update: {
                useDecimals: body.useDecimals,
                isClearingEnabled: body.isClearingEnabled,
                enableCustomerAccounts: body.enableCustomerAccounts
            },
            create: {
                key: "global",
                useDecimals: body.useDecimals,
                isClearingEnabled: body.isClearingEnabled ?? false,
                enableCustomerAccounts: body.enableCustomerAccounts ?? false
            }
        });
        return NextResponse.json(settings);
    } catch (error) {
        return NextResponse.json({ error: "Error updating settings" }, { status: 500 });
    }
}

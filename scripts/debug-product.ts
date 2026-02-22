import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    const product = await prisma.product.findFirst({
        where: { name: { contains: "libretas de capybara" } },
        include: {
            stocks: { include: { branch: true } },
            prices: { include: { priceList: true } }
        }
    });

    console.log(JSON.stringify(product, null, 2));
}

main().finally(() => prisma.$disconnect());

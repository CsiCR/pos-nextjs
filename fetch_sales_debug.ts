
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    const sales = await prisma.sale.findMany({
        where: {
            number: {
                in: [71, 72, 73, 74, 75]
            }
        },
        include: {
            items: {
                include: {
                    product: {
                        include: {
                            branch: true
                        }
                    }
                }
            },
            branch: true,
            paymentDetails: true
        },
        orderBy: {
            number: 'asc'
        }
    });

    const outputPath = 'sales_output.json';
    fs.writeFileSync(outputPath, JSON.stringify(sales, null, 2), 'utf-8');
    console.log(`Data written to ${outputPath}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

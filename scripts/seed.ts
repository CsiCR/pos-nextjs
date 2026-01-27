import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const pwd = await bcrypt.hash("demo123", 10);

  console.log("🌱 Seeding database (Minimal Configuration)...");

  // 1. Branches
  const branch = await prisma.branch.upsert({
    where: { name: "Casa Central" },
    update: {},
    create: { name: "Casa Central", address: "Av. Siempre Viva 123" }
  });
  console.log("✅ Branch created: Casa Central");

  // 2. Price Lists
  await prisma.priceList.upsert({
    where: { name: "General" },
    update: {},
    create: { name: "General", percentage: 0 }
  });
  console.log("✅ Price List created: General");

  // 3. Users
  // Admin
  await prisma.user.upsert({
    where: { email: "admin@el24.com" },
    update: {},
    create: {
      email: "admin@el24.com",
      password: pwd,
      name: "Administrador",
      role: "ADMIN",
      branchId: branch.id
    }
  });

  // Cajero
  await prisma.user.upsert({
    where: { email: "cajero@el24.com" },
    update: {},
    create: {
      email: "cajero@el24.com",
      password: pwd,
      name: "Cajero Demo",
      role: "CAJERO",
      branchId: branch.id
    }
  });

  // Gerente
  await prisma.user.upsert({
    where: { email: "gerente@el24.com" },
    update: {},
    create: {
      email: "gerente@el24.com",
      password: pwd,
      name: "Gerente General",
      role: "GERENTE",
      // Gerante might not need a specific branch, or can be assigned to Central by default
      branchId: branch.id
    }
  });
  console.log("✅ Users created (Admin, Cajero, Gerente)");

  console.log("✨ Seed completed successfully! (No products/units/categories created)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

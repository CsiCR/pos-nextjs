import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Users
  const pwd = await bcrypt.hash("demo123", 10);
  const pwd2 = await bcrypt.hash("johndoe123", 10);
  
  await prisma.user.upsert({
    where: { email: "supervisor@el24.com" },
    update: {},
    create: { email: "supervisor@el24.com", password: pwd, name: "Supervisor", role: "SUPERVISOR" }
  });
  await prisma.user.upsert({
    where: { email: "cajero@el24.com" },
    update: {},
    create: { email: "cajero@el24.com", password: pwd, name: "Cajero Demo", role: "CAJERO" }
  });
  await prisma.user.upsert({
    where: { email: "john@doe.com" },
    update: {},
    create: { email: "john@doe.com", password: pwd2, name: "Admin", role: "SUPERVISOR" }
  });

  // Categories
  const cats = ["Bebidas", "Snacks", "Lácteos", "Limpieza", "Varios"];
  for (const name of cats) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }

  // Products
  const products = [
    { code: "INT001", name: "Coca Cola 600ml", price: 1500, stock: 50, category: "Bebidas" },
    { code: "INT002", name: "Pepsi 600ml", price: 1400, stock: 40, category: "Bebidas" },
    { code: "INT003", name: "Agua Mineral 500ml", price: 800, stock: 100, category: "Bebidas" },
    { code: "INT004", name: "Papas Fritas Lays", price: 2000, stock: 30, category: "Snacks" },
    { code: "INT005", name: "Chocolate Milka", price: 2500, stock: 25, category: "Snacks" },
    { code: "INT006", name: "Leche Entera 1L", price: 1200, stock: 60, category: "Lácteos" },
    { code: "INT007", name: "Yogurt Frutilla", price: 900, stock: 40, category: "Lácteos" },
    { code: "INT008", name: "Detergente 1L", price: 3500, stock: 20, category: "Limpieza" },
    { code: "INT009", name: "Jabón en Barra", price: 600, stock: 80, category: "Limpieza" },
    { code: "INT010", name: "Pan Lactal", price: 1800, stock: 15, category: "Varios" },
  ];

  for (const p of products) {
    const cat = await prisma.category.findUnique({ where: { name: p.category } });
    await prisma.product.upsert({
      where: { code: p.code },
      update: {},
      create: { code: p.code, name: p.name, price: p.price, stock: p.stock, categoryId: cat?.id }
    });
  }

  console.log("Seed completed!");
}

main().catch(console.error).finally(() => prisma.$disconnect());

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });
        if (!user || !user.active) return null;
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          branchId: user.branchId
        } as any;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.branchId = user.branchId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        // Refetch user to get up-to-date branch/role
        const freshUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true, branchId: true }
        });

        session.user = {
          ...session.user,
          id: token.id as string,
          role: freshUser?.role || (token.role as any),
          branchId: freshUser?.branchId || (token.branchId as any)
        } as any;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login"
  },
  session: { strategy: "jwt" }
};

import NextAuth, { DefaultSession } from "next-auth";
import { Role } from "@prisma/client";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            role: Role;
            branchId?: string;
        } & DefaultSession["user"];
    }

    interface User {
        role: Role;
        branchId?: string;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string;
        role: Role;
        branchId?: string;
    }
}

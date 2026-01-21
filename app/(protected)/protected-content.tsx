"use client";
import { SessionProvider } from "next-auth/react";
import { Navbar } from "@/components/navbar";
import { ReactNode } from "react";

export function ProtectedContent({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto p-4">{children}</main>
      </div>
    </SessionProvider>
  );
}

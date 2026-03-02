"use client";
import { SessionProvider } from "next-auth/react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { ReactNode, Suspense } from "react";
import { APP_VERSION } from "@/lib/constants";

export function ProtectedContent({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <main className="max-w-7xl mx-auto p-4 flex-1 w-full">
          <Suspense fallback={<div className="text-center py-20">Cargando...</div>}>
            {children}
          </Suspense>
        </main>
        <footer className="text-center py-4 text-[10px] text-gray-400 uppercase tracking-widest">
          <p>© {new Date().getFullYear()} Multirubro 24 - Sistema de Punto de Venta</p>
          <p className="font-bold">VERSIÓN {APP_VERSION}</p>
          <div className="flex justify-center gap-4 mt-2 lowercase">
            <Link href="/legal" className="hover:text-gray-600 transition-colors">Términos y Condiciones</Link>
            <Link href="/legal" className="hover:text-gray-600 transition-colors">Seguridad y Privacidad</Link>
          </div>
        </footer>
      </div>
    </SessionProvider >
  );
}

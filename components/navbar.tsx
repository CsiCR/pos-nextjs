"use client";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store, LayoutDashboard, ShoppingCart, Package, Users, Clock, Search, LogOut, Menu, X, Tag, Settings, ArrowRightLeft, Truck, DollarSign } from "lucide-react";
import { useState } from "react";
import { useSettings } from "@/hooks/use-settings";

export function Navbar() {
  const { data: session } = useSession() || {};
  const pathname = usePathname();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const isSupervisor = (session?.user as any)?.role === "SUPERVISOR" || (session?.user as any)?.role === "ADMIN";

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/pos", label: "POS", icon: ShoppingCart },
    { href: "/historial", label: "Historial", icon: Clock },
    { href: "/verificador", label: "Precios", icon: Search },
    ...(isSupervisor ? [
      { href: "/productos", label: "Stock", icon: Package },
      ...(settings.isClearingEnabled ? [
        { href: "/logistica", label: "Logística", icon: Truck },
        { href: "/clearing", label: "Clearing", icon: DollarSign }
      ] : []),
      { href: "/configuracion", label: "Configuración", icon: Settings }, // Updated label and icon
    ] : []),
    { href: "/turnos", label: "Turnos", icon: Clock },
  ];

  return (
    <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/dashboard" className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
            <span className="text-blue-600 font-bold text-xl hidden sm:inline">Multirubro 24</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {links.map(l => (
              <Link key={l.href} href={l.href} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${pathname === l.href ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`}>
                <l.icon className="w-4 h-4" /> {l.label}
              </Link>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-4">
            <span className="text-sm text-gray-600">{session?.user?.name} ({session?.user?.role})</span>
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn btn-secondary text-sm py-2">
              <LogOut className="w-4 h-4" /> Salir
            </button>
          </div>
          <button className="md:hidden p-2" onClick={() => setOpen(!open)}>
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden bg-white border-t p-4 space-y-2">
          {links.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={`flex items-center gap-2 px-4 py-3 rounded-lg ${pathname === l.href ? "bg-blue-100 text-blue-700" : "text-gray-600"}`}>
              <l.icon className="w-5 h-5" /> {l.label}
            </Link>
          ))}
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn btn-danger w-full mt-4">
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </div>
      )}
    </nav>
  );
}

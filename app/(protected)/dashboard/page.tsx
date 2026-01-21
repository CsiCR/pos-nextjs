"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { DollarSign, ShoppingCart, Package, Users, TrendingUp, Clock } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { data: session } = useSession() || {};
  const [data, setData] = useState<any>(null);
  const isSupervisor = session?.user?.role === "SUPERVISOR";

  useEffect(() => {
    fetch("/api/dashboard").then(r => r.json()).then(setData);
  }, []);

  if (!data) return <div className="text-center py-20">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <span className="text-gray-500">Hola, {session?.user?.name}</span>
      </div>

      {isSupervisor ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={DollarSign} label="Ventas Hoy" value={`$${(data?.todaySales || 0).toLocaleString()}`} sub={`${data?.todayCount || 0} ventas`} color="blue" />
            <StatCard icon={TrendingUp} label="Ventas Totales" value={`$${(data?.totalSales || 0).toLocaleString()}`} sub={`${data?.totalCount || 0} ventas`} color="green" />
            <StatCard icon={Package} label="Productos" value={data?.products || 0} color="purple" />
            <StatCard icon={Users} label="Usuarios" value={data?.users || 0} color="orange" />
          </div>
          <div className="card">
            <h2 className="font-semibold mb-4">Ventas por Método de Pago</h2>
            <div className="grid grid-cols-3 gap-4">
              {(data?.salesByMethod || []).map((m: any) => (
                <div key={m.paymentMethod} className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-500">{m.paymentMethod}</p>
                  <p className="text-xl font-bold">${(m._sum?.total || 0).toLocaleString()}</p>
                  <p className="text-sm text-gray-400">{m._count} ventas</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {data.hasOpenShift ? (
            <div className="grid grid-cols-2 gap-4">
              <StatCard icon={DollarSign} label="Ventas del Turno" value={`$${(data?.shiftSales || 0).toLocaleString()}`} color="blue" />
              <StatCard icon={ShoppingCart} label="Cantidad de Ventas" value={data?.shiftCount || 0} color="green" />
            </div>
          ) : (
            <div className="card text-center py-12">
              <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No tienes un turno abierto</h2>
              <p className="text-gray-500 mb-6">Abre un turno para comenzar a vender</p>
              <Link href="/turnos" className="btn btn-primary inline-flex">Abrir Turno</Link>
            </div>
          )}
        </>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Link href="/pos" className="card hover:shadow-lg transition flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center"><ShoppingCart className="w-7 h-7 text-blue-600" /></div>
          <div><h3 className="font-semibold">Punto de Venta</h3><p className="text-sm text-gray-500">Realizar ventas</p></div>
        </Link>
        <Link href="/verificador" className="card hover:shadow-lg transition flex items-center gap-4">
          <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center"><Package className="w-7 h-7 text-green-600" /></div>
          <div><h3 className="font-semibold">Verificador de Precios</h3><p className="text-sm text-gray-500">Consultar productos</p></div>
        </Link>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: any) {
  const colors: any = { blue: "bg-blue-100 text-blue-600", green: "bg-green-100 text-green-600", purple: "bg-purple-100 text-purple-600", orange: "bg-orange-100 text-orange-600" };
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}><Icon className="w-6 h-6" /></div>
      <div><p className="text-sm text-gray-500">{label}</p><p className="text-xl font-bold">{value}</p>{sub && <p className="text-xs text-gray-400">{sub}</p>}</div>
    </div>
  );
}

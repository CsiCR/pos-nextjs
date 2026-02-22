"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { DollarSign, ShoppingCart, Package, Users, TrendingUp, Clock, AlertTriangle, Filter, Calendar, CreditCard, X } from "lucide-react";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import { useSettings } from "@/hooks/use-settings";

const getLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function DashboardPage() {
  const { data: session } = useSession() || {};
  const { settings } = useSettings();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [filters, setFilters] = useState(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const y = firstDay.getFullYear();
    const m = String(firstDay.getMonth() + 1).padStart(2, '0');
    const d = String(firstDay.getDate()).padStart(2, '0');
    return {
      startDate: `${y}-${m}-${d}`,
      endDate: "", // User requested "fin en blanco" (empty end date for open range or today?) 
      // User said: "fin en blanco". But Dashboard StatLinks use filters.endDate || getLocalDate(new Date()) fallback.
      // If I leave it empty here, the link generation needs to handle it.
      // The current link generation code is: 
      // href={`/historial?...&endDate=${filters.endDate || getLocalDate(new Date())}...`}
      // This means if I leave it empty, it defaults to TODAY in the link.
      // This matches the user request indirectly (default view shows up to today).
      // Let's keep endDate empty in state but verify link logic.
      branchId: "",
      userId: ""
    };
  });

  // Resources for Selects
  const [branches, setBranches] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);

  const role = (session?.user as any)?.role;
  const isSupervisorOrHigher = role === "SUPERVISOR" || role === "ADMIN" || role === "GERENTE";
  const canFilterBranch = role === "ADMIN" || role === "GERENTE";

  useEffect(() => {
    if (isSupervisorOrHigher) {
      // Load resources for filters
      fetch("/api/branches").then(r => r.json()).then(setBranches);
      fetch("/api/users").then(r => r.json()).then(setUsersList);
    }
  }, [isSupervisorOrHigher]);

  useEffect(() => {
    fetchDashboardData();
  }, [filters]);

  const fetchDashboardData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.startDate) params.append("startDate", filters.startDate);
    if (filters.endDate) params.append("endDate", filters.endDate);
    if (filters.branchId) params.append("branchId", filters.branchId);
    if (filters.userId) params.append("userId", filters.userId);

    fetch(`/api/dashboard?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });
  };

  const clearFilters = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const y = firstDay.getFullYear();
    const m = String(firstDay.getMonth() + 1).padStart(2, '0');
    const d = String(firstDay.getDate()).padStart(2, '0');
    setFilters({ startDate: `${y}-${m}-${d}`, endDate: "", branchId: "", userId: "" });
  };

  const [showFilters, setShowFilters] = useState(false);

  if (loading && !data) return <div className="text-center py-20">Cargando dashboard...</div>;
  if (!data || data.error) return (
    <div className="text-center py-20 space-y-4">
      <p className="text-red-500 font-bold">{data?.error || "Error al cargar datos"}</p>
      <button onClick={() => fetchDashboardData()} className="btn btn-secondary">Reintentar</button>
    </div>
  );

  const hasActiveFilters = filters.branchId || filters.userId || filters.endDate;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Bienvenido de nuevo, {session?.user?.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data?.missingCount > 0 && (
            <Link
              href={`/productos?filterMode=missing${filters.branchId ? `&branchId=${filters.branchId}` : (role === "SUPERVISOR" ? `&branchId=${(session?.user as any)?.branchId || ""}` : "")}`}
              className="flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-full animate-pulse text-sm hover:bg-red-200 transition"
              title="Productos sin stock"
            >
              <AlertTriangle className="w-5 h-5" />
              <span className="font-semibold">{data.missingCount} críticos</span>
            </Link>
          )}
          {data?.lowStockCount > 0 && (
            <Link
              href={`/productos?filterMode=low_stock${filters.branchId ? `&branchId=${filters.branchId}` : (role === "SUPERVISOR" ? `&branchId=${(session?.user as any)?.branchId || ""}` : "")}`}
              className="flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-full text-sm hover:bg-orange-200 transition"
              title="Productos por debajo del stock mínimo"
            >
              <AlertTriangle className="w-5 h-5" />
              <span className="font-semibold">{data.lowStockCount} alertas</span>
            </Link>
          )}
          {isSupervisorOrHigher && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition ${showFilters || hasActiveFilters ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              <Filter className="w-4 h-4" />
              {showFilters ? 'Ocultar Filtros' : 'Filtros'}
              {hasActiveFilters && !showFilters && <span className="w-2 h-2 bg-orange-400 rounded-full"></span>}
            </button>
          )}
        </div>
      </div>

      {isSupervisorOrHigher && (
        <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-300 ${showFilters ? 'max-h-[1000px] opacity-100 p-4' : 'max-h-0 opacity-0 p-0 border-none'}`}>
          <div className="flex items-center justify-between mb-4 border-b pb-2">
            <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">Ajustar Periodo y Filtros</span>
            <button onClick={clearFilters} className="text-xs text-red-500 hover:underline flex items-center gap-1 font-bold">
              <X className="w-3 h-3" /> Limpiar Todo
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Desde</label>
              <input type="date" className="input text-sm py-1.5" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Hasta</label>
              <input type="date" className="input text-sm py-1.5" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} />
            </div>

            {role === "GERENTE" && (
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Supervisor</label>
                <select
                  className="input text-sm py-1.5 w-full"
                  value={(Array.isArray(usersList) ? usersList : []).find(u => u.branchId === filters.branchId && u.role === "SUPERVISOR")?.id || ""}
                  onChange={e => {
                    const supId = e.target.value;
                    const sup = usersList.find(u => u.id === supId);
                    if (sup?.branchId) setFilters({ ...filters, branchId: sup.branchId });
                    else if (!supId) setFilters({ ...filters, branchId: "" });
                  }}
                >
                  <option value="">Todos los Supervisores</option>
                  {(usersList || [])
                    .filter((u: any) => u.role === "SUPERVISOR")
                    .filter((u: any) => !filters.branchId || u.branchId === filters.branchId)
                    .map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Sucursal</label>
              <select
                className="input text-sm py-1.5 w-full font-bold"
                value={filters.branchId}
                onChange={e => {
                  const newBranchId = e.target.value;
                  const currentUser = usersList.find(u => u.id === filters.userId);
                  let newUserId = filters.userId;

                  // Reset user filter if inconsistent with NEW branch (unless global)
                  if (newBranchId && currentUser && currentUser.branchId !== newBranchId) {
                    newUserId = "";
                  }

                  setFilters({ ...filters, branchId: newBranchId, userId: newUserId });
                }}
                disabled={!canFilterBranch}
              >
                <option value="">{canFilterBranch ? "Todas las Sucursales" : "Mi Sucursal"}</option>
                {Array.isArray(branches) && branches.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Vendedor</label>
              <select
                className="input text-sm py-1.5 w-full"
                value={filters.userId}
                onChange={e => setFilters({ ...filters, userId: e.target.value })}
              >
                <option value="">Todos los Vendedores</option>
                {(Array.isArray(usersList) ? usersList : [])
                  .filter((u: any) => !filters.branchId || u.branchId === filters.branchId)
                  .map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
              </select>
            </div>

          </div>
        </div>
      )}

      {isSupervisorOrHigher ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <Link href={`/historial?view=items&startDate=${getLocalDate(new Date())}&endDate=${getLocalDate(new Date())}&branchId=${filters.branchId}&userId=${filters.userId}`} className="block">
              <StatCard icon={DollarSign} label="Ventas Hoy" value={`$${(data?.todaySales || 0).toLocaleString()}`} sub={`${data?.todayCount || 0} ventas`} color="blue" />
            </Link>
            <Link href={`/historial?view=items&startDate=${filters.startDate}&endDate=${filters.endDate}&branchId=${filters.branchId}&userId=${filters.userId}`} className="block">
              <StatCard icon={TrendingUp} label="Ventas Totales" value={`$${(data?.totalSales || 0).toLocaleString()}`} sub={`${data?.totalCount || 0} ventas`} color="green" />
            </Link>
            <Link href="/productos" className="block">
              <StatCard icon={Package} label="Productos Activos" value={data?.products || 0} color="purple" />
            </Link>
            <StatCard icon={Users} label="Usuarios Activos" value={data?.users || 0} color="orange" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                Ventas por Método de Pago
              </h2>
              {data?.salesByMethod?.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {(data?.salesByMethod || []).map((m: any) => (
                    <Link
                      key={m.paymentMethod}
                      href={`/historial?view=items&paymentMethod=${m.paymentMethod}&startDate=${filters.startDate}&endDate=${filters.endDate}&branchId=${filters.branchId}&userId=${filters.userId}`}
                      className="bg-gray-50 p-4 rounded-xl border border-gray-100 hover:border-blue-300 hover:shadow-md transition block"
                    >
                      <p className="text-sm text-gray-500 font-medium mb-1">{m.paymentMethod}</p>
                      <p className={`font-bold text-gray-900 ${getResponsiveFontSize(`$${(m.total || m._sum?.total || 0).toLocaleString()}`, "text-xl")}`}>
                        ${(m.total || m._sum?.total || 0).toLocaleString()}
                      </p>

                      {m.clearing > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-xs text-orange-600 font-medium flex justify-between">
                            <span>Clearing:</span>
                            <span>- {formatPrice(m.clearing, settings.useDecimals)}</span>
                          </p>
                          <p className="text-xs text-green-700 font-bold flex justify-between mt-0.5">
                            <span>Neto:</span>
                            <span>{formatPrice(m.net, settings.useDecimals)}</span>
                          </p>
                        </div>
                      )}

                      <p className="text-xs text-gray-400 mt-2 text-right">{m.count || m._count} operaciones</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 italic text-sm text-center py-8">No hay datos para mostrar con los filtros actuales.</p>
              )}
            </div>

            <div className="card bg-gradient-to-br from-blue-600 to-blue-800 text-white">
              <h2 className="font-semibold mb-4 text-white/90">Acceso Rápido</h2>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/pos" className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition text-center backdrop-blur-sm border border-white/10">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-2" />
                  <span className="font-medium">POS</span>
                </Link>
                <Link href="/productos" className="bg-white/10 hover:bg-white/20 p-4 rounded-xl transition text-center backdrop-blur-sm border border-white/10">
                  <Package className="w-8 h-8 mx-auto mb-2" />
                  <span className="font-medium">Stock</span>
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {data?.hasOpenShift ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard icon={DollarSign} label="Ventas del Turno" value={`$${(data?.shiftSales || 0).toLocaleString()}`} color="blue" />
                <StatCard icon={ShoppingCart} label="Cantidad de Ventas" value={data?.shiftCount || 0} color="green" />
              </div>

              {data?.salesByMethod?.length > 0 && (
                <div className="card mt-6">
                  <h2 className="font-semibold mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    Detalle por Método de Pago
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {data.salesByMethod.map((m: any) => (
                      <div key={m.paymentMethod} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="text-sm text-gray-500 font-medium mb-1">{m.paymentMethod}</p>
                        <p className={`font-bold text-gray-900 ${getResponsiveFontSize(`$${(m.total || 0).toLocaleString()}`, "text-xl")}`}>
                          ${(m.total || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{m.count} ventas</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4 mt-6">
                <Link href="/pos" className="btn btn-primary h-auto py-4 text-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-200">
                  <ShoppingCart className="w-6 h-6" /> Ir al POS
                </Link>
                <Link href="/verificador" className="btn btn-secondary h-auto py-4 text-lg flex items-center justify-center gap-2">
                  <Package className="w-6 h-6" /> Verificador
                </Link>
              </div>
            </>
          ) : (
            <div className="card text-center py-12 bg-gray-50 border-2 border-dashed border-gray-200">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-10 h-10 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">No tienes un turno abierto</h2>
              <p className="text-gray-500 mb-8 max-w-xs mx-auto">Abre un turno para comenzar a registrar ventas y manejar el stock de la sucursal.</p>
              <Link href="/turnos" className="btn btn-primary btn-lg shadow-lg shadow-blue-200">Abrir Turno Ahora</Link>
            </div>
          )}
        </>
      )
      }

      {/* FOOTER LINKS (Only for Supervisor/Admin as Cashier has them inline above) */}
      {
        isSupervisorOrHigher && (
          <div className="grid md:grid-cols-2 gap-4 pt-4">
            <Link href="/pos" className="card hover:shadow-xl hover:-translate-y-1 transition duration-300 flex items-center gap-5 border border-gray-100 group">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 transition duration-300">
                <ShoppingCart className="w-8 h-8 text-blue-600 group-hover:text-white transition duration-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Punto de Venta</h3>
                <p className="text-gray-500">Realizar ventas y facturación rápida</p>
              </div>
            </Link>
            <Link href="/verificador" className="card hover:shadow-xl hover:-translate-y-1 transition duration-300 flex items-center gap-5 border border-gray-100 group">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center group-hover:bg-green-600 transition duration-300">
                <Package className="w-8 h-8 text-green-600 group-hover:text-white transition duration-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Verificador de Precios</h3>
                <p className="text-gray-500">Consulta rápida de stock y precios</p>
              </div>
            </Link>
          </div>
        )
      }
    </div >
  );
}

const getResponsiveFontSize = (value: string | number, baseSize: string = "text-2xl") => {
  const length = String(value).length;
  if (length > 12) return "text-sm md:text-xl";
  if (length > 10) return "text-base md:text-xl";
  if (length > 8) return "text-lg md:text-2xl";
  return baseSize;
};

function StatCard({ icon: Icon, label, value, sub, color }: any) {
  const colors: any = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    purple: "bg-purple-100 text-purple-600",
    orange: "bg-orange-100 text-orange-600",
    red: "bg-red-100 text-red-600"
  };
  return (
    <div className="card flex items-center gap-4 hover:shadow-md transition border border-gray-50">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-7 h-7" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className={`font-bold text-gray-900 ${getResponsiveFontSize(value)}`}>{value}</p>
        {sub && <p className="text-xs font-medium text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

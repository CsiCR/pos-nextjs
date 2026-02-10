"use client";
import { useState, useEffect } from "react";
import { Clock, Play, Square, AlertTriangle, Receipt, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatPrice, formatDateTime } from "@/lib/utils";
import { useSettings } from "@/hooks/use-settings";

export default function TurnosPage() {
  const { settings } = useSettings();
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [initialCash, setInitialCash] = useState(0);
  const [declaredAmount, setDeclaredAmount] = useState(0);
  const [discrepancyReason, setDiscrepancyReason] = useState("");
  const [discrepancyNote, setDiscrepancyNote] = useState("");
  const [closeError, setCloseError] = useState<any>(null);
  const router = useRouter();

  const fetchData = async () => {
    setLoading(true);
    const [curr, all] = await Promise.all([
      fetch("/api/shifts/current").then(r => r.json()),
      fetch("/api/shifts").then(r => r.json())
    ]);
    setCurrentShift(curr?.id ? curr : null);
    setShifts(all || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openShift = async () => {
    await fetch("/api/shifts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initialCash }) });
    setOpenModal(false);
    setInitialCash(0);
    fetchData();
  };

  const closeShift = async () => {
    const res = await fetch(`/api/shifts/${currentShift.id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ declaredAmount, discrepancyReason: discrepancyReason || undefined, discrepancyNote: discrepancyNote || undefined })
    });
    const data = await res.json();
    if (!res.ok) {
      setCloseError(data);
      return;
    }
    setCloseModal(false);
    setDeclaredAmount(0);
    setDiscrepancyReason("");
    setDiscrepancyNote("");
    setCloseError(null);
    fetchData();
  };

  const shiftTotal = currentShift?.sales?.reduce((s: number, sale: any) => s + Number(sale?.total ?? 0), 0) || 0;
  const cashSales = currentShift?.sales?.reduce((sum: number, s: any) => {
    if (s?.paymentMethod === "EFECTIVO") return sum + Number(s?.total ?? 0) + Number(s?.adjustment ?? 0);
    if (s?.paymentMethod === "MIXTO" && s?.paymentDetails) {
      const cashPart = s.paymentDetails.find((pd: any) => pd.method === "EFECTIVO");
      return sum + Number(cashPart?.amount ?? 0);
    }
    return sum;
  }, 0) || 0;

  const qrSales = currentShift?.sales?.reduce((sum: number, s: any) => {
    if (s?.paymentMethod === "QR") return sum + Number(s?.total ?? 0);
    if (s?.paymentMethod === "MIXTO" && s?.paymentDetails) {
      const qrPart = s.paymentDetails.find((pd: any) => pd.method === "QR");
      return sum + Number(qrPart?.amount ?? 0);
    }
    return sum;
  }, 0) || 0;

  const totalChange = currentShift?.sales?.reduce((sum: number, s: any) => sum + Math.max(0, Number(s?.change ?? 0)), 0) || 0;

  const expectedAmount = Number(currentShift?.initialCash || 0) + cashSales - totalChange;

  if (loading) return <div className="text-center py-20">Cargando...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gestión de Turnos</h1>

      {currentShift ? (
        <div className="card bg-green-50 border-green-200">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="font-bold text-green-800">Turno Activo</h2>
                <p className="text-sm text-green-600">Desde: {formatDateTime(currentShift.openedAt)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => router.push(`/historial?shiftId=${currentShift.id}`)} className="btn btn-outline border-green-300 text-green-700 hover:bg-green-100">
                <Receipt className="w-4 h-4" /> Ver Ventas
              </button>
              <button onClick={() => { setDeclaredAmount(expectedAmount); setCloseModal(true); }} className="btn btn-danger">
                <Square className="w-4 h-4" /> Cerrar Turno
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-white rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500">Caja Inicial</p>
              <p className="text-xl font-bold">{formatPrice(currentShift.initialCash ?? 0, settings.useDecimals)}</p>
            </div>
            <div className="bg-white rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500">Ventas del Turno</p>
              <p className="text-xl font-bold">{formatPrice(shiftTotal, settings.useDecimals)}</p>
              <div className="flex justify-center gap-2 text-[10px] mt-1 text-gray-400">
                <span>Efe: {formatPrice(cashSales, settings.useDecimals)}</span>
                <span>•</span>
                <span>QR: {formatPrice(qrSales, settings.useDecimals)}</span>
                <span>•</span>
                <span>Otros: {formatPrice(shiftTotal - cashSales - qrSales, settings.useDecimals)}</span>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500">Efectivo Esperado</p>
              <p className="text-xl font-bold">{formatPrice(expectedAmount, settings.useDecimals)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No hay turno abierto</h2>
          <p className="text-gray-500 mb-6">Abre un turno para comenzar a vender</p>
          <button onClick={() => setOpenModal(true)} className="btn btn-primary btn-lg inline-flex">
            <Play className="w-5 h-5" /> Abrir Turno
          </button>
        </div>
      )}

      <div className="card">
        <h2 className="font-bold mb-4">Historial de Turnos</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">Usuario</th>
                <th className="px-4 py-3 text-left">Apertura</th>
                <th className="px-4 py-3 text-left">Cierre</th>
                <th className="px-4 py-3 text-right">Ventas</th>
                <th className="px-4 py-3 text-right">Diferencia</th>
                <th className="px-4 py-3 text-left">Motivo</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(shifts ?? []).filter(s => s?.closedAt).map(s => (
                <tr key={s.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-4 py-3">{s.user?.name}</td>
                  <td className="px-4 py-3">{formatDateTime(s.openedAt)}</td>
                  <td className="px-4 py-3">{formatDateTime(s.closedAt)}</td>
                  <td className="px-4 py-3 text-right font-bold">{s._count?.sales || 0}</td>
                  <td className={`px-4 py-3 text-right font-medium ${s.discrepancy && s.discrepancy !== 0 ? (s.discrepancy > 0 ? "text-green-600" : "text-red-600") : ""}`}>
                    {s.discrepancy ? `$${s.discrepancy.toLocaleString()}` : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 group relative cursor-help">
                      <span>{s.discrepancyReason || "-"}</span>
                      {s.discrepancyNote && (
                        <span className="text-xs text-blue-500 font-bold" title={s.discrepancyNote}>(i)</span>
                      )}
                      {/* Simple browser native tooltip via title is easiest, but let's make it robust */}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => router.push(`/historial?shiftId=${s.id}`)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Ver Ventas de este turno"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {openModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Abrir Turno</h2>
            <label className="block text-sm text-gray-500 mb-2">Monto inicial en caja</label>
            <input type="number" value={initialCash} onChange={e => setInitialCash(Number(e.target.value))} className="input mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setOpenModal(false)} className="btn btn-secondary flex-1">Cancelar</button>
              <button onClick={openShift} className="btn btn-primary flex-1">Abrir</button>
            </div>
          </div>
        </div>
      )}

      {closeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Cerrar Turno</h2>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-500">Efectivo esperado en caja</p>
              <p className="text-2xl font-bold">{formatPrice(expectedAmount, settings.useDecimals)}</p>
            </div>
            <label className="block text-sm text-gray-500 mb-2">Monto declarado</label>
            <input type="number" value={declaredAmount} onChange={e => setDeclaredAmount(Number(e.target.value))} className="input mb-4" />

            {closeError && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-yellow-700 mb-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">Hay una diferencia de {formatPrice(Math.abs(closeError.discrepancy ?? 0), settings.useDecimals)}</span>
                </div>
                <label className="block text-sm text-gray-500 mb-2">Motivo de la diferencia *</label>
                <select value={discrepancyReason} onChange={e => setDiscrepancyReason(e.target.value)} className="input mb-2">
                  <option value="">Seleccionar...</option>
                  <option value="ERROR">Error de caja</option>
                  <option value="GASTO">Gasto</option>
                  <option value="RETIRO">Retiro de efectivo</option>
                  <option value="OTRO">Otro</option>
                </select>
                <input type="text" value={discrepancyNote} onChange={e => setDiscrepancyNote(e.target.value)} placeholder="Nota adicional" className="input" />
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setCloseModal(false); setCloseError(null); }} className="btn btn-secondary flex-1">Cancelar</button>
              <button onClick={closeShift} className="btn btn-danger flex-1">Cerrar Turno</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

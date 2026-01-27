"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ArrowRightLeft, ArrowUpRight, ArrowDownLeft, CheckCircle2, Clock, XCircle, DollarSign, Send, Info } from "lucide-react";
import { formatPrice } from "@/lib/utils";

export default function ClearingPage() {
    const { data: session } = useSession();
    const [balances, setBalances] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("obligations"); // obligations | receivables
    const [settlements, setSettlements] = useState<any[]>([]);

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState<any>(null);
    const [amount, setAmount] = useState("");
    const [notes, setNotes] = useState("");

    const isAdmin = (session?.user as any)?.role === "ADMIN" || (session?.user as any)?.role === "GERENTE";

    const fetchData = async () => {
        setLoading(true);
        try {
            const [balRes, setRes] = await Promise.all([
                fetch("/api/clearing/balance"),
                fetch(`/api/clearing/settlements?mode=${activeTab === "obligations" ? "outgoing" : "incoming"}`)
            ]);

            const balData = await balRes.json();
            const setData = await setRes.json();

            if (balData.balances) setBalances(balData.balances);
            if (Array.isArray(setData)) setSettlements(setData);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const handleSettle = async () => {
        if (!amount || isNaN(Number(amount))) return alert("Monto inválido");
        if (!selectedBranch) return;

        try {
            const res = await fetch("/api/clearing/settlements", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetBranchId: selectedBranch.branchId,
                    amount: Number(amount),
                    notes
                })
            });

            if (res.ok) {
                setModalOpen(false);
                setAmount("");
                setNotes("");
                fetchData();
                alert("Rendición enviada correctamente. Esperando confirmación.");
            } else {
                alert("Error al enviar rendición");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleConfirm = async (settlementId: string, status: "CONFIRMED" | "REJECTED") => {
        if (!confirm(`¿Estás seguro de ${status === "CONFIRMED" ? "confirmar" : "rechazar"} este pago?`)) return;
        try {
            const res = await fetch("/api/clearing/settlements", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: settlementId, status })
            });
            if (res.ok) fetchData();
        } catch (e) { console.error(e); }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                        <ArrowRightLeft className="w-8 h-8 text-blue-600" />
                        Clearing & Tesorería
                    </h1>
                    <p className="text-gray-500">Gestión de compensaciones entre sucursales</p>
                </div>

                <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1">
                    <button
                        onClick={() => setActiveTab("obligations")}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === "obligations" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:bg-gray-200"}`}
                    >
                        <ArrowUpRight className="w-4 h-4" /> Mis Deudas (A Pagar)
                    </button>
                    <button
                        onClick={() => setActiveTab("receivables")}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === "receivables" ? "bg-white shadow-sm text-green-600" : "text-gray-500 hover:bg-gray-200"}`}
                    >
                        <ArrowDownLeft className="w-4 h-4" /> Por Cobrar
                    </button>
                </div>
            </div>

            {/* DASHBOARD CARDS */}
            {loading && balances.length === 0 ? (
                <div className="py-20 text-center text-gray-400 font-bold animate-pulse">Calculando balances...</div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {balances.filter(b => activeTab === "obligations" ? b.remainingDebt > 0 || b.paidPending > 0 : b.remainingReceivable > 0 || b.receivedPending > 0).length === 0 && (
                        <div className="col-span-full py-12 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                            <p className="text-gray-500 font-bold">¡Estás al día! No tienes {activeTab === "obligations" ? "deudas pendientes" : "cobros pendientes"}.</p>
                        </div>
                    )}

                    {balances
                        .filter(b => activeTab === "obligations" ? b.remainingDebt > 0 || b.paidPending > 0 : b.remainingReceivable > 0 || b.receivedPending > 0)
                        .map((b) => {
                            const isOwing = activeTab === "obligations";
                            const amount = isOwing ? b.remainingDebt : b.remainingReceivable;
                            const pendingAmount = isOwing ? b.paidPending : b.receivedPending;

                            return (
                                <div key={b.branchId} className="card border border-gray-100 shadow-lg relative overflow-hidden">
                                    <div className={`absolute top-0 left-0 w-2 h-full ${isOwing ? "bg-orange-500" : "bg-green-500"}`} />
                                    <div className="pl-4">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{isOwing ? "Debes a" : "Te debe"}</p>
                                                <h3 className="text-xl font-bold text-gray-800">{b.branchName}</h3>
                                            </div>
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isOwing ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600"}`}>
                                                <DollarSign className="w-6 h-6" />
                                            </div>
                                        </div>

                                        <div className="mb-6">
                                            <p className="text-3xl font-black text-gray-900">{formatPrice(amount)}</p>
                                            <p className="text-xs text-gray-500 font-medium mt-1">Saldo pendiente acumulado</p>
                                        </div>

                                        {/* BREAKDOWN DISPLAY */}
                                        {((isOwing ? b.debtBreakdown : b.receivableBreakdown) && Object.keys(isOwing ? b.debtBreakdown : b.receivableBreakdown).length > 0) && (
                                            <div className="mb-6 p-4 bg-gray-50/80 rounded-xl border border-gray-100">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                                    {isOwing ? "Discriminar por origen" : "Discriminar por origen"}
                                                </p>
                                                <div className="space-y-1.5">
                                                    {Object.entries((isOwing ? b.debtBreakdown : b.receivableBreakdown) as Record<string, number>).map(([method, amt]) => (
                                                        <div key={method} className="flex justify-between items-center text-xs">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`w-1.5 h-1.5 rounded-full ${method === "EFECTIVO" ? "bg-green-500" : "bg-blue-500"}`} />
                                                                <span className="font-bold text-gray-600 text-[11px]">{method}</span>
                                                            </div>
                                                            <span className="font-mono font-bold text-gray-900">{formatPrice(amt)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {pendingAmount > 0 && (
                                            <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 mb-6 flex items-start gap-3">
                                                <Clock className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-xs font-bold text-yellow-800">En proceso: {formatPrice(pendingAmount)}</p>
                                                    <p className="text-[10px] text-yellow-600 leading-tight">Pagos enviados esperando confirmación.</p>
                                                </div>
                                            </div>
                                        )}

                                        {isOwing && amount > 10 && (
                                            <button
                                                onClick={() => { setSelectedBranch(b); setModalOpen(true); }}
                                                className="w-full btn btn-primary flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
                                            >
                                                <Send className="w-4 h-4" /> Realizar Rendición
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                </div>
            )}

            {/* SETTLEMENTS LIST */}
            <div className="mt-10">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-400" />
                    Historial de Movimientos ({activeTab === "obligations" ? "Enviados" : "Recibidos"})
                </h3>
                <div className="card overflow-hidden p-0 border border-gray-100 shadow-sm">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-500 font-bold uppercase tracking-wider text-left">
                            <tr>
                                <th className="px-6 py-4">Fecha</th>
                                <th className="px-6 py-4">{activeTab === "obligations" ? "Destinatario" : "Remitente"}</th>
                                <th className="px-6 py-4">Nota</th>
                                <th className="px-6 py-4 text-right">Monto</th>
                                <th className="px-6 py-4 text-center">Estado</th>
                                {activeTab === "receivables" && <th className="px-6 py-4 text-right">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {settlements.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-8 text-gray-400 italic">No hay movimientos registrados.</td></tr>
                            ) : settlements.map(s => (
                                <tr key={s.id} className="hover:bg-gray-50/50">
                                    <td className="px-6 py-4 text-gray-500">{new Date(s.createdAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-bold text-gray-700">{activeTab === "obligations" ? s.targetBranch?.name : s.sourceBranch?.name}</td>
                                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{s.notes || "-"}</td>
                                    <td className="px-6 py-4 text-right font-mono font-bold">{formatPrice(s.amount)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${s.status === "CONFIRMED" ? "bg-green-100 text-green-700" :
                                            s.status === "REJECTED" ? "bg-red-100 text-red-700" :
                                                "bg-yellow-100 text-yellow-700"
                                            }`}>
                                            {s.status === "PENDING" ? "PENDIENTE" : s.status === "CONFIRMED" ? "CONFIRMADO" : "RECHAZADO"}
                                        </span>
                                    </td>
                                    {activeTab === "receivables" && (
                                        <td className="px-6 py-4 text-right">
                                            {s.status === "PENDING" && (
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => handleConfirm(s.id, "CONFIRMED")} className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition" title="Confirmar Recepción"><CheckCircle2 className="w-4 h-4" /></button>
                                                    <button onClick={() => handleConfirm(s.id, "REJECTED")} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition" title="Rechazar"><XCircle className="w-4 h-4" /></button>
                                                </div>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL */}
            {modalOpen && selectedBranch && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <h2 className="text-2xl font-black text-gray-900 mb-2">Nueva Rendición</h2>
                        <p className="text-gray-500 mb-6 text-sm">Estás por informar un pago a <strong className="text-gray-800">{selectedBranch.branchName}</strong></p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Monto a Enviar</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                    <input
                                        type="number"
                                        className="input input-lg pl-8 font-black text-blue-600"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <p className="text-xs text-gray-400 mt-1 text-right">Pendiente actual: {formatPrice(selectedBranch.remainingDebt)}</p>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Nota / Referencia</label>
                                <textarea
                                    className="input h-24 py-3 text-sm"
                                    placeholder="Ej: Efectivo sobre #59, Transferencia #1234..."
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-8">
                            <button onClick={() => setModalOpen(false)} className="btn bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold">Cancelar</button>
                            <button onClick={handleSettle} className="btn btn-primary font-bold shadow-lg shadow-blue-200">Enviar Rendición</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

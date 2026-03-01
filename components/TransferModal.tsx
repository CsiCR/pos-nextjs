"use client";
import { useState, useEffect } from "react";
import { X, ArrowRightLeft, Store, Package, AlertTriangle, CheckCircle2, Send } from "lucide-react";
import { formatStock } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface TransferModalProps {
    onClose: () => void;
    products: any[]; // The products to transfer
    branches: any[]; // Available branches
    userBranchId: string;
    onSuccess: () => void;
}

export function TransferModal({ onClose, products, branches, userBranchId, onSuccess }: TransferModalProps) {
    const router = useRouter();
    const [targetBranchId, setTargetBranchId] = useState("");
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter out the source branch from targets
    const availableTargets = branches.filter(b => b.id !== userBranchId && b.active);

    useEffect(() => {
        // Initialize quantities with 1 for each product
        const initial: Record<string, number> = {};
        products.forEach(p => {
            initial[p.id] = 1;
        });
        setQuantities(initial);
    }, [products]);

    const handleSubmit = async () => {
        if (!targetBranchId) return setError("Debes seleccionar una sucursal de destino.");

        const items = products.map(p => ({
            productId: p.id,
            quantity: quantities[p.id] || 0
        })).filter(item => item.quantity > 0);

        if (items.length === 0) return setError("Debes ingresar al menos una cantidad válida.");

        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/transfers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sourceBranchId: userBranchId,
                    targetBranchId,
                    items,
                    notes
                })
            });

            if (res.ok) {
                onSuccess();
                onClose();
                router.push("/logistica");
                alert("Solicitud de traspaso creada con éxito. Redirigiendo a Logística.");
            } else {
                const data = await res.json();
                setError(data.error || "Error al crear el traspaso");
            }
        } catch (e) {
            setError("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 scale-in-center">
            <div className="bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                            <ArrowRightLeft className="w-6 h-6 text-orange-600" />
                        </div>
                        Solicitar Traspaso
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-400">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="mb-6 flex items-center gap-2 text-sm">
                    <span className="font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-lg">ORIGEN</span>
                    <span className="font-black text-orange-600 tracking-tight">
                        {branches.find(b => b.id === userBranchId)?.name || 'Tu Sucursal'}
                    </span>
                </div>

                <div className="space-y-6 flex-1 overflow-auto pr-2 custom-scrollbar">
                    {/* Destination Selection */}
                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 block flex items-center gap-2">
                            <Store className="w-4 h-4" /> Sucursal de Destino
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {availableTargets.map(b => (
                                <button
                                    key={b.id}
                                    onClick={() => setTargetBranchId(b.id)}
                                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 text-center h-full ${targetBranchId === b.id ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-lg shadow-blue-100' : 'border-gray-200 bg-white text-gray-500 hover:border-blue-200 hover:bg-blue-50/10'}`}
                                >
                                    <Store className={`w-6 h-6 ${targetBranchId === b.id ? 'text-blue-600' : 'text-gray-300'}`} />
                                    <span className="text-xs font-black uppercase tracking-tighter leading-tight">{b.name}</span>
                                </button>
                            ))}
                        </div>
                        {availableTargets.length === 0 && (
                            <p className="text-sm text-orange-600 font-bold flex items-center gap-2 italic">
                                <AlertTriangle className="w-4 h-4" /> No hay otras sucursales activas disponibles.
                            </p>
                        )}
                    </div>

                    {/* Products List */}
                    <div className="space-y-3">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 block">Mercadería a Traspasar</label>
                        <div className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr className="text-left font-bold text-gray-500 text-[10px] uppercase tracking-widest">
                                        <th className="px-5 py-3">Producto</th>
                                        <th className="px-5 py-3 text-right">Stock Actual</th>
                                        <th className="px-5 py-3 text-right w-32">Cantidad</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 bg-white">
                                    {products.map(p => {
                                        const stock = p.displayStock ?? (p.stocks?.find((s: any) => s.branchId === userBranchId)?.quantity || 0);
                                        return (
                                            <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-5 py-4">
                                                    <p className="font-black text-gray-900 leading-tight">{p.name}</p>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{p.code}</p>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <span className={`font-bold ${Number(stock) <= 0 ? 'text-red-500' : 'text-gray-600'}`}>
                                                        {formatStock(stock, p.baseUnit)}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={quantities[p.id] || ""}
                                                        onChange={e => setQuantities({ ...quantities, [p.id]: Number(e.target.value) })}
                                                        className="w-full bg-gray-50 border-gray-200 rounded-xl px-4 py-2 text-right font-black text-blue-600 focus:ring-2 focus:ring-blue-500 transition-all"
                                                        placeholder="0"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Notas / Observaciones (Opcional)</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Ej: Pedido urgente, reposición semanal..."
                            className="input h-24 py-4 rounded-3xl text-sm"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3 animate-pulse">
                            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                            <p className="text-sm font-bold text-red-800 leading-tight">{error}</p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-6 border-t mt-6">
                    <button onClick={onClose} className="btn bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold border-none h-14 rounded-2xl">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !targetBranchId || availableTargets.length === 0}
                        className="btn btn-primary shadow-xl shadow-blue-100 font-bold h-14 rounded-2xl gap-3 flex items-center justify-center group"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                Iniciar Solicitud
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

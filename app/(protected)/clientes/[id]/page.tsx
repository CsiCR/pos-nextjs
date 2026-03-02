"use client";
import { useState, useEffect } from "react";
import { ArrowLeft, CreditCard, History as HistoryIcon, TrendingUp, TrendingDown, AlertCircle, Plus, X, Banknote } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatPrice, formatDateTime } from "@/lib/utils";
import { useSettings } from "@/hooks/use-settings";
import { toast } from "sonner";

export default function CustomerDetailPage() {
    const { settings } = useSettings();
    const [customer, setCustomer] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentDescription, setPaymentDescription] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [hasShift, setHasShift] = useState<boolean | null>(null);
    const [paymentMethod, setPaymentMethod] = useState("EFECTIVO");
    const [paymentDetails, setPaymentDetails] = useState<{ method: string, amount: string }[]>([]);

    const params = useParams();

    const fetchCustomer = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/customers/${params.id}`);
            const data = await res.json();
            setCustomer(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const checkShift = async () => {
        try {
            const res = await fetch("/api/shifts/current");
            const d = await res.json();
            setHasShift(!!d?.id);
        } catch (e) {
            setHasShift(false);
        }
    };

    useEffect(() => {
        fetchCustomer();
        checkShift();
    }, [params.id]);

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
            return toast.error("El monto debe ser mayor a 0");
        }

        setIsSaving(true);
        try {
            const res = await fetch(`/api/customers/${params.id}/payments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: paymentAmount,
                    description: paymentDescription || `Abono (${paymentMethod}) desde la ficha del cliente`,
                    method: paymentMethod,
                    paymentDetails: paymentMethod === "MIXTO" ? paymentDetails : undefined
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Error al registrar el pago");
            }

            toast.success("Pago registrado exitosamente");
            setShowPaymentModal(false);
            setPaymentAmount("");
            setPaymentDescription("");
            setPaymentDetails([]);
            setPaymentMethod("EFECTIVO");
            await fetchCustomer();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div className="text-center py-20">Cargando...</div>;
    if (!customer) return <div className="text-center py-20">Cliente no encontrado</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <Link href="/clientes" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </Link>
                    <h1 className="text-3xl font-black text-gray-800 tracking-tight">Detalle del Cliente</h1>
                </div>
                {hasShift && (
                    <button
                        onClick={() => {
                            setShowPaymentModal(true);
                            setPaymentAmount(customer.balance.toString());
                        }}
                        className="btn btn-success gap-2 shadow-lg shadow-green-100 hover:scale-105 active:scale-95 transition-all py-6 px-8 rounded-2xl font-black text-lg"
                    >
                        <Plus className="w-6 h-6" /> Registrar Pago
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-blue-600" />
                        </div>
                        <h3 className="font-black text-gray-400 uppercase text-[10px] tracking-widest">Saldo Actual</h3>
                    </div>
                    <p className={`text-3xl font-black ${Number(customer.balance) > 0 ? "text-red-600" : "text-green-600"}`}>
                        {formatPrice(customer.balance, settings.useDecimals)}
                    </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-orange-600" />
                        </div>
                        <h3 className="font-black text-gray-400 uppercase text-[10px] tracking-widest">Límite de Crédito</h3>
                    </div>
                    <p className="text-3xl font-black text-gray-800">
                        {formatPrice(customer.maxCredit, settings.useDecimals)}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1 font-bold uppercase">
                        Disponible: {formatPrice(Number(customer.maxCredit) - Number(customer.balance), settings.useDecimals)}
                    </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-purple-50 rounded-2xl flex items-center justify-center">
                            <HistoryIcon className="w-5 h-5 text-purple-600" />
                        </div>
                        <h3 className="font-black text-gray-400 uppercase text-[10px] tracking-widest">Último Movimiento</h3>
                    </div>
                    <p className="text-sm font-bold text-gray-600">
                        {customer.transactions?.[0] ? formatDateTime(customer.transactions[0].createdAt) : "Sin movimientos"}
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b">
                    <h2 className="font-black text-gray-800 uppercase text-xs tracking-widest">Historial de Movimientos</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
                            <tr>
                                <th className="px-6 py-4">Fecha</th>
                                <th className="px-6 py-4">Tipo</th>
                                <th className="px-6 py-4">Descripción</th>
                                <th className="px-6 py-4 text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {(customer.transactions || []).map((tx: any) => (
                                <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {formatDateTime(tx.createdAt)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${tx.type === "SALE" ? "bg-red-50 text-red-600" :
                                            tx.type === "PAYMENT" ? "bg-green-50 text-green-600" :
                                                "bg-gray-100 text-gray-600"
                                            }`}>
                                            {tx.type === "SALE" ? "Venta" : tx.type === "PAYMENT" ? "Abono" : "Ajuste"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-bold flex items-center gap-2">
                                                {tx.saleId && tx.sale ? (
                                                    <>
                                                        Venta #
                                                        <Link
                                                            href={`/historial?saleId=${tx.saleId}`}
                                                            className="text-blue-600 hover:underline hover:text-blue-800 transition-colors"
                                                        >
                                                            {tx.sale.number}
                                                        </Link>
                                                        {tx.description.toLowerCase().includes("ajuste") ? " (Ajuste)" :
                                                            tx.description.toLowerCase().includes("pago") ? " (Pago)" : ""}
                                                    </>
                                                ) : tx.description.includes("#") ? (
                                                    <>
                                                        {tx.description.split("#")[0]}#
                                                        <Link
                                                            href={`/historial?saleId=${tx.saleId}`}
                                                            className="text-blue-600 hover:underline hover:text-blue-800 transition-colors"
                                                        >
                                                            {tx.description.split("#")[1]?.split(" ")[0]}
                                                        </Link>
                                                        {tx.description.split("#")[1]?.split(" ").slice(1).join(" ")}
                                                    </>
                                                ) : tx.description}
                                            </span>
                                            {tx.sale && tx.sale.branch && (
                                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                                    📍 Sucursal: {tx.sale.branch.name}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-black text-gray-900">
                                        <div className="flex items-center justify-end gap-2">
                                            {tx.type === "SALE" ? <TrendingUp className="w-3 h-3 text-red-500" /> : <TrendingDown className="w-3 h-3 text-green-500" />}
                                            {formatPrice(tx.amount, settings.useDecimals)}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <form onSubmit={handlePayment}>
                            <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
                                <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                    <Banknote className="w-6 h-6 text-green-600" /> Registrar Pago
                                </h2>
                                <button type="button" onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block text-center">Medio de Pago</label>
                                    <div className="grid grid-cols-3 gap-1 mb-4">
                                        {["EFECTIVO", "DEBITO", "CREDITO", "QR", "TRANSFERENCIA", "MIXTO"].map(m => (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => {
                                                    setPaymentMethod(m);
                                                    if (m === "MIXTO" && paymentDetails.length === 0) {
                                                        setPaymentDetails([{ method: "EFECTIVO", amount: paymentAmount }]);
                                                    }
                                                }}
                                                className={`py-2 px-1 rounded-xl text-[9px] font-black transition-all border ${paymentMethod === m
                                                    ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100"
                                                    : "bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200"}`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {paymentMethod === "MIXTO" ? (
                                    <div className="bg-blue-50/50 p-4 rounded-3xl border border-blue-100 space-y-3">
                                        <div className="flex justify-between items-center px-1">
                                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Desglose Mixto</span>
                                            <button
                                                type="button"
                                                onClick={() => setPaymentDetails([...paymentDetails, { method: "EFECTIVO", amount: "0" }])}
                                                className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded-lg font-black hover:bg-blue-700 transition"
                                            >
                                                + AGREGAR
                                            </button>
                                        </div>
                                        {paymentDetails.map((pd, idx) => (
                                            <div key={idx} className="flex gap-2 items-center animate-in slide-in-from-left-2 duration-200">
                                                <select
                                                    value={pd.method}
                                                    onChange={e => {
                                                        const newDetails = [...paymentDetails];
                                                        newDetails[idx].method = e.target.value;
                                                        setPaymentDetails(newDetails);
                                                    }}
                                                    className="select select-sm bg-white border-gray-200 font-bold text-[10px] rounded-xl flex-1"
                                                >
                                                    {["EFECTIVO", "DEBITO", "CREDITO", "QR", "TRANSFERENCIA"].map(m => (
                                                        <option key={m} value={m}>{m}</option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="number"
                                                    value={pd.amount}
                                                    onChange={e => {
                                                        const newDetails = [...paymentDetails];
                                                        newDetails[idx].amount = e.target.value;
                                                        setPaymentDetails(newDetails);
                                                    }}
                                                    className="input input-sm bg-white border-gray-200 font-black text-xs text-right w-24 rounded-xl"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setPaymentDetails(paymentDetails.filter((_, i) => i !== idx))}
                                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                        <div className="pt-2 border-t border-blue-100 flex justify-between items-center px-1">
                                            <span className="text-[10px] font-black text-blue-500">TOTAL DESGLOSE</span>
                                            <span className={`text-xs font-black ${Math.abs(paymentDetails.reduce((sum, d) => sum + parseFloat(d.amount || "0"), 0) - parseFloat(paymentAmount || "0")) < 0.01
                                                    ? "text-green-600" : "text-red-500"
                                                }`}>
                                                ${paymentDetails.reduce((sum, d) => sum + parseFloat(d.amount || "0"), 0).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block text-center">Monto a abonar *</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-300">$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                required
                                                autoFocus
                                                value={paymentAmount}
                                                onChange={e => setPaymentAmount(e.target.value)}
                                                className="input pl-14 h-20 text-4xl font-black text-green-600 border-gray-200 bg-gray-50 focus:bg-white focus:ring-8 focus:ring-green-50 transition-all text-right pr-6 shadow-inner"
                                                placeholder="0.00"
                                                onFocus={e => e.target.select()}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="col-span-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Descripción / Nota</label>
                                    <textarea
                                        value={paymentDescription}
                                        onChange={e => setPaymentDescription(e.target.value)}
                                        className="textarea w-full bg-gray-50 border-gray-200 font-bold resize-none"
                                        placeholder="Ej: comentarios"
                                        rows={2}
                                    />
                                </div>
                            </div>

                            <div className="p-6 bg-gray-50 border-t flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowPaymentModal(false)}
                                    className="btn btn-secondary flex-1"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving || !paymentAmount}
                                    className="btn btn-success flex-1 font-black"
                                >
                                    {isSaving ? "Procesando..." : "Confirmar Pago"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

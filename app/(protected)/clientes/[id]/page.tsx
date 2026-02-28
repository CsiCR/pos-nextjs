"use client";
import { useState, useEffect } from "react";
import { ArrowLeft, CreditCard, History as HistoryIcon, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatPrice, formatDateTime } from "@/lib/utils";
import { useSettings } from "@/hooks/use-settings";

export default function CustomerDetailPage() {
    const { id } = useParams();
    const { settings } = useSettings();
    const [customer, setCustomer] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchCustomer = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/customers/${id}`);
            const data = await res.json();
            setCustomer(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomer();
    }, [id]);

    if (loading) return <div className="text-center py-20">Cargando...</div>;
    if (!customer) return <div className="text-center py-20">Cliente no encontrado</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/clientes" className="p-2 hover:bg-gray-100 rounded-full transition">
                    <ArrowLeft className="w-6 h-6 text-gray-600" />
                </Link>
                <div>
                    <h1 className="text-2xl font-black text-gray-800">{customer.name}</h1>
                    <p className="text-sm text-gray-500">{customer.document || "Sin documento"}</p>
                </div>
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
                            {customer.transactions?.map((tx: any) => (
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
                                        {tx.description}
                                        {tx.saleId && (
                                            <Link href={`/historial?search=${tx.saleId}`} className="ml-2 text-blue-500 hover:underline">
                                                (Ver Venta)
                                            </Link>
                                        )}
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
        </div>
    );
}

"use client";

import { useState } from "react";
import { X, RefreshCcw, AlertTriangle, Check } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface RefundModalProps {
    sale: any;
    onClose: () => void;
    onSuccess: () => void;
}

export function RefundModal({ sale, onClose, onSuccess }: RefundModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Calculate remaining quantities
    // We need to know how many were already refunded.
    // Ideally passed in `sale` object (if it includes refunds relation).
    // Assuming sale.refunds is populated (as per our API logic, but we need to ensure it's fetched in UI).

    const [itemsToRefund, setItemsToRefund] = useState<{ [productId: string]: number }>({});

    const getRemainingQty = (productId: string, originalQty: number) => {
        if (!sale.refunds) return originalQty;
        let refunded = 0;
        sale.refunds.forEach((ref: any) => {
            ref.items.forEach((item: any) => {
                if (item.productId === productId) {
                    refunded += Math.abs(Number(item.quantity));
                }
            });
        });
        return originalQty - refunded;
    };

    const handleToggleItem = (productId: string, maxQty: number) => {
        setItemsToRefund(prev => {
            const current = prev[productId];
            if (current) {
                const next = { ...prev };
                delete next[productId];
                return next;
            } else {
                return { ...prev, [productId]: maxQty }; // Select max by default
            }
        });
    };

    const handleQtyChange = (productId: string, qty: number, max: number) => {
        if (qty < 1) qty = 1;
        if (qty > max) qty = max;
        setItemsToRefund(prev => ({ ...prev, [productId]: qty }));
    };

    const calculateRefundTotal = () => {
        let total = 0;
        sale.items.forEach((item: any) => {
            const qty = itemsToRefund[item.productId] || 0;
            if (qty > 0) {
                // Price calculation: (Price - (Discount/Qty)) * RefundQty ??
                // Or just simpler:
                const unitPrice = Number(item.price);
                const unitDiscount = Number(item.discount) / Number(item.quantity);
                total += (unitPrice - unitDiscount) * qty;
            }
        });
        return total;
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError("");

        try {
            const payloadItems = Object.entries(itemsToRefund).map(([productId, quantity]) => ({
                productId,
                quantity
            }));

            if (payloadItems.length === 0) {
                setError("Seleccione al menos un ítem.");
                setLoading(false);
                return;
            }

            const res = await fetch(`/api/sales/${sale.id}/refund`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: payloadItems })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Error al procesar devolución");
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const totalRefund = calculateRefundTotal();

    // If sale type is REFUND, show error or view mode? 
    // UI logic: Should hide button in parent. Assuming here we are valid.

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <RefreshCcw className="w-5 h-5 text-orange-500" />
                        Gestionar Devolución
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    <p className="text-sm text-gray-500 mb-4">
                        Seleccione los ítems que desea devolver. Se generará una Nota de Crédito y se ajustará el stock automáticamente.
                    </p>

                    <div className="space-y-3">
                        {sale.items.map((item: any) => {
                            const remaining = getRemainingQty(item.productId, Number(item.quantity));
                            const isSelected = !!itemsToRefund[item.productId];
                            const isDisabled = remaining <= 0;

                            return (
                                <div key={item.id} className={`p-3 rounded-xl border ${isSelected ? 'border-orange-500 bg-orange-50' : 'border-gray-100 bg-gray-50'} transition-all`}>
                                    <div className="flex items-start gap-3">
                                        <div className="pt-1">
                                            <input
                                                type="checkbox"
                                                disabled={isDisabled}
                                                checked={isSelected}
                                                onChange={() => handleToggleItem(item.productId, remaining)}
                                                className="w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer disabled:opacity-50"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <p className={`font-bold ${isDisabled ? 'text-gray-400' : 'text-gray-800'}`}>
                                                    {item.product?.name}
                                                </p>
                                                <p className="font-mono text-sm text-gray-600">
                                                    ${formatPrice(Number(item.subtotal) / Number(item.quantity), false)}
                                                </p>
                                            </div>

                                            <div className="flex justify-between items-end mt-2">
                                                <div className="text-xs text-gray-500">
                                                    Comprado: {item.quantity} | <span className={remaining === 0 ? "text-green-600 font-bold" : "text-gray-700"}>Disp: {remaining}</span>
                                                </div>

                                                {isSelected && (
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-xs font-bold text-gray-600">Cant:</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max={remaining}
                                                            value={itemsToRefund[item.productId]}
                                                            onChange={(e) => handleQtyChange(item.productId, parseInt(e.target.value) || 0, remaining)}
                                                            className="input input-xs w-16 text-center font-bold"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-6 flex justify-between items-center p-4 bg-orange-50 rounded-xl border border-orange-100">
                        <span className="font-bold text-orange-800">Total a Reembolsar</span>
                        <span className="text-2xl font-black text-orange-600">${formatPrice(totalRefund, true)}</span>
                    </div>
                </div>

                <div className="p-6 border-t bg-gray-50 rounded-b-3xl flex justify-end gap-3">
                    <button onClick={onClose} disabled={loading} className="btn bg-white border border-gray-200 text-gray-700 hover:bg-gray-100">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || totalRefund <= 0}
                        className="btn bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-200 disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                    >
                        {loading ? <span className="animate-spin">⏳</span> : <Check className="w-4 h-4" />}
                        Confirmar Devolución
                    </button>
                </div>
            </div>
        </div>
    );
}

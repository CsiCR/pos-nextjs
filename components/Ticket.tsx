import React, { useState } from "react";
import { Printer, X, MessageSquare, RefreshCcw } from "lucide-react";
import { RefundModal } from "@/components/RefundModal";

interface TicketProps {
    sale: any;
    onClose: () => void;
}

export const Ticket = ({ sale, onClose }: TicketProps) => {
    const [showRefundModal, setShowRefundModal] = useState(false);

    const handlePrint = () => {
        window.print();
    };

    const handleWhatsApp = () => {
        const message = `*Ticket de Control Interno - El 24*\n` +
            `--------------------------------\n` +
            `*Venta:* #${sale.number || sale.id.slice(-6).toUpperCase()}\n` +
            `*Fecha:* ${new Date(sale.createdAt).toLocaleString()}\n` +
            `*Cajero:* ${sale.user?.name || "N/A"}\n` +
            `--------------------------------\n` +
            sale.items.map((i: any) => `${i.quantity} x ${i.product?.name || "Producto"} = $${(i.subtotal || i.price * i.quantity).toLocaleString()}`).join("\n") +
            `\n--------------------------------\n` +
            `*TOTAL: $${sale.total.toLocaleString()}*\n` +
            `*Pago:* ${sale.paymentMethod}\n` +
            `--------------------------------\n` +
            `¡Gracias por elegir El 24!`;

        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col max-h-[90vh]">
                {/* Actions Header */}
                <div className="flex items-center justify-between p-4 border-b no-print">
                    <h3 className="font-bold text-gray-700">
                        {sale.type === "REFUND" ? "Nota de Crédito" : "Comprobante de Venta"}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Ticket Content (Scrollable) */}
                <div className="flex-1 overflow-auto p-4 bg-gray-50 flex justify-center custom-scrollbar">
                    <div id="thermal-ticket" className="bg-white p-8 w-full shadow-sm border border-gray-100 font-mono text-black print:shadow-none print:border-none print:p-0" style={{ maxWidth: "80mm" }}>
                        <div className="text-center mb-6">
                            <h1 className="text-3xl font-black mb-1">EL 24</h1>
                            <p className="text-[10px] leading-tight text-gray-500 uppercase">
                                {sale.type === "REFUND" ? "NOTA DE CRÉDITO / DEVOLUCIÓN" : "Control Interno de Venta"}
                            </p>
                        </div>

                        <div className="border-t border-dashed border-gray-300 my-4"></div>

                        <div className="text-[10px] space-y-1 mb-4">
                            <div className="flex justify-between">
                                <span>{sale.type === "REFUND" ? "NC:" : "VENTA:"}</span>
                                <span className="font-bold">#{sale.number || sale.id.slice(-6).toUpperCase()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>FECHA:</span>
                                <span>{new Date(sale.createdAt).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>CAJERO:</span>
                                <span className="uppercase">{sale.user?.name || "Usuario"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>SUCURSAL:</span>
                                <span className="uppercase">{sale.branch?.name || "-"}</span>
                            </div>
                        </div>

                        <table className="w-full text-[10px] mb-4">
                            <thead>
                                <tr className="border-b border-dashed border-gray-300">
                                    <th className="text-left py-2 font-bold">CANT</th>
                                    <th className="text-left py-2 font-bold">DESC</th>
                                    <th className="text-right py-2 font-bold">SUB</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dashed divide-gray-100">
                                {sale.items.map((item: any) => (
                                    <tr key={item.id} className="align-top">
                                        {/* Show absolute quantity for Refunds to avoid confusion on paper, or negative? 
                                            Usually NC shows negative total but positive items or clear indication.
                                            Let's show DB value (negative if refund) or absolute? 
                                            Standard is: Quantity -1. Price 100. Subtotal -100. */}
                                        <td className="py-2 pr-2">{item.quantity}</td>
                                        <td className="py-2 pr-2 uppercase leading-tight">{item.product?.name || "Producto"}</td>
                                        <td className="py-2 text-right">${(item.subtotal || item.price * item.quantity).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="border-t border-dashed border-gray-300 my-4"></div>

                        <div className="space-y-1 mb-6">
                            <div className="flex justify-between text-lg font-black">
                                <span>TOTAL:</span>
                                <span>${sale.total.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span>PAGO:</span>
                                <span className="font-bold uppercase">{sale.paymentMethod}</span>
                            </div>
                            {/* Detailed breakdown for Mixed or just general info */}
                            {sale.paymentDetails?.length > 0 && (
                                <div className="space-y-0.5 mt-1 border-l-2 border-gray-200 pl-2">
                                    {sale.paymentDetails.map((pd: any, idx: number) => (
                                        <div key={idx} className="flex justify-between text-[9px] text-gray-500">
                                            <span>- {pd.method}</span>
                                            <span>${Number(pd.amount).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {sale.cashReceived > 0 && sale.paymentMethod !== "MIXTO" && (
                                <div className="flex justify-between text-[10px]">
                                    <span>RECIBIDO:</span>
                                    <span>${sale.cashReceived.toLocaleString()}</span>
                                </div>
                            )}
                            {sale.change > 0 && (
                                <div className="flex justify-between text-[10px]">
                                    <span>VUELTO:</span>
                                    <span>${sale.change.toLocaleString()}</span>
                                </div>
                            )}
                            {sale.discount > 0 && (
                                <div className="flex justify-between text-[10px] text-red-600">
                                    <span>DESCUENTO:</span>
                                    <span>-${sale.discount.toLocaleString()}</span>
                                </div>
                            )}
                            {sale.adjustment !== 0 && (
                                <div className="flex justify-between text-[10px] text-gray-500 italic">
                                    <span>AJUSTE:</span>
                                    <span>${sale.adjustment > 0 ? '+' : ''}{sale.adjustment.toLocaleString()}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col items-center gap-2 mt-8">
                            {/* QR Code using public API for zero-dependency */}
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`SALE:${sale.id}`)}`}
                                alt="QR Venta"
                                className="w-24 h-24"
                            />
                            <p className="text-[8px] uppercase tracking-widest font-bold">¡Gracias por su visita!</p>
                        </div>
                    </div>
                </div>

                {/* Action Buttons Footer */}
                <div className="p-4 border-t flex flex-wrap gap-2 justify-center no-print">
                    <button onClick={handlePrint} className="btn bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center gap-2 py-2 px-4 rounded-xl font-bold flex-1">
                        <Printer className="w-4 h-4" /> Imprimir
                    </button>
                    <button onClick={handleWhatsApp} className="btn bg-green-500 hover:bg-green-600 text-white flex items-center justify-center gap-2 py-2 px-4 rounded-xl font-bold flex-1">
                        <MessageSquare className="w-4 h-4" /> WhatsApp
                    </button>

                    {sale.type !== "REFUND" && (
                        <button
                            onClick={() => setShowRefundModal(true)}
                            className="btn bg-orange-100 hover:bg-orange-200 text-orange-700 flex items-center justify-center gap-2 py-2 px-4 rounded-xl font-bold flex-1"
                        >
                            <RefreshCcw className="w-4 h-4" /> Devolución
                        </button>
                    )}
                </div>
            </div>

            <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #thermal-ticket, #thermal-ticket * {
            visibility: visible;
          }
          #thermal-ticket {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            z-index: 1000;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

            {showRefundModal && (
                <RefundModal
                    sale={sale}
                    onClose={() => setShowRefundModal(false)}
                    onSuccess={() => {
                        setShowRefundModal(false);
                        onClose(); // Close ticket to refresh list (or refetch? Close is simpler)
                    }}
                />
            )}
        </div>
    );
};

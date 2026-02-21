"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
    Truck,
    ArrowUpRight,
    ArrowDownLeft,
    CheckCircle2,
    Clock,
    XCircle,
    Package,
    Info,
    Eye,
    AlertTriangle,
    CheckCircle,
    Camera,
    RefreshCcw,
    Send,
    Search,
    Plus,
    Minus
} from "lucide-react";
import { formatStock, formatDateTime } from "@/lib/utils";
import { processInvoiceImage } from "@/lib/ocr";
import Link from "next/link";

export default function LogisticaPage() {
    const { data: session } = useSession();
    const [transfers, setTransfers] = useState<any[]>([]);
    const [stockEntries, setStockEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [enabled, setEnabled] = useState(true);
    const [activeTab, setActiveTab] = useState("outgoing"); // outgoing | incoming | history

    // Modal State for Viewing/Managing a single transfer
    const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
    const [modalMode, setModalMode] = useState<"view" | "emit" | "receive" | "entry" | null>(null);
    const [justifications, setJustifications] = useState<Record<string, string>>({});
    const [itemsData, setItemsData] = useState<Record<string, { receivedQuantity: number, justification: string, photoUrl?: string }>>({});
    const [uploading, setUploading] = useState<string | null>(null); // itemId
    const [entryStep, setEntryStep] = useState(1);
    const [entryData, setEntryData] = useState<any>({ items: [] });
    const [ocrProcessing, setOcrProcessing] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [creatingProductFor, setCreatingProductFor] = useState<number | null>(null); // Index of the item being created as new

    // Search for manual item addition
    const [itemSearch, setItemSearch] = useState("");
    const [itemSearchResults, setItemSearchResults] = useState<any[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    // Categories and Units for quick product creation
    const [categories, setCategories] = useState<any[]>([]);
    const [units, setUnits] = useState<any[]>([]);

    const handleUpload = async (itemId: string, file: File) => {
        setUploading(itemId);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData
            });
            if (res.ok) {
                const { url } = await res.json();
                const newData = { ...itemsData };
                newData[itemId] = { ...(newData[itemId] || { receivedQuantity: 0, justification: "" }), photoUrl: url };
                setItemsData(newData);
            } else {
                alert("Error al subir imagen");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setUploading(null);
        }
    };

    const isAdmin = (session?.user as any)?.role === "ADMIN" || (session?.user as any)?.role === "GERENTE";
    const userBranchId = (session?.user as any)?.branchId;

    const fetchData = async () => {
        setLoading(true);
        try {
            const settingsRes = await fetch("/api/settings");
            const settings = await settingsRes.json();

            if (settings && settings.isClearingEnabled === false && !isAdmin) {
                setEnabled(false);
                setLoading(false);
                return;
            }

            const [transfersRes, entriesRes, catsRes, unitsRes] = await Promise.all([
                fetch("/api/transfers"),
                fetch("/api/stock-entries"),
                fetch("/api/categories"),
                fetch("/api/measurement-units")
            ]);

            const [transfersData, entriesData, catsData, unitsData] = await Promise.all([
                transfersRes.json(),
                entriesRes.json(),
                catsRes.json(),
                unitsRes.json()
            ]);

            setCategories(catsData);
            setUnits(unitsData);

            if (Array.isArray(transfersData)) setTransfers(transfersData);
            if (Array.isArray(entriesData)) setStockEntries(entriesData);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Debounced search for manual item addition in entry modal
    useEffect(() => {
        if (!itemSearch || itemSearch.length < 2) {
            setItemSearchResults([]);
            return;
        }

        setSearchLoading(true);
        const t = setTimeout(() => {
            fetch(`/api/products?search=${itemSearch}`)
                .then(r => r.json())
                .then(data => {
                    const products = data.products || [];
                    setItemSearchResults(products.slice(0, 10)); // Show top 10 results
                })
                .catch(err => console.error("Search error:", err))
                .finally(() => setSearchLoading(false));
        }, 300);

        return () => clearTimeout(t);
    }, [itemSearch]);

    useEffect(() => {
        fetchData();
    }, []);

    const filteredMovements = (() => {
        if (activeTab === "outgoing") return transfers.filter(t => t.sourceBranchId === userBranchId && (t.status === "PENDIENTE" || t.status === "EN_TRANSITO")).map(t => ({ ...t, type: 'transfer' }));
        if (activeTab === "incoming") return transfers.filter(t => t.targetBranchId === userBranchId && (t.status === "PENDIENTE" || t.status === "EN_TRANSITO")).map(t => ({ ...t, type: 'transfer' }));

        // History: Combined Completed Transfers + Stock Entries
        const historyTransfers = transfers.filter(t => t.status === "COMPLETADO" || t.status === "CANCELADO").map(t => ({ ...t, type: 'transfer' }));
        const historyEntries = stockEntries.map(e => ({ ...e, type: 'entry' }));

        return [...historyTransfers, ...historyEntries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    })();

    const handleEmit = async () => {
        if (!selectedTransfer) return;
        setActionLoading(true);
        try {
            const res = await fetch(`/api/transfers/${selectedTransfer.id}/emit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ justifications })
            });
            if (res.ok) {
                alert("Transferencia emitida correctamente. La mercadería está en tránsito.");
                setModalMode(null);
                setSelectedTransfer(null);
                fetchData();
            } else {
                const data = await res.json();
                alert(data.error || "Error al emitir transferencia");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(false);
        }
    };

    const handleReceive = async () => {
        if (!selectedTransfer) return;

        // Validation: if received < sent, justification is mandatory
        for (const item of selectedTransfer.items) {
            const data = itemsData[item.id] || { receivedQuantity: item.quantity, justification: "" };
            if (Number(data.receivedQuantity) !== Number(item.quantity)) {
                if (!data.justification || data.justification.trim().length < 5) {
                    alert(`Debes proporcionar una justificación de al menos 5 caracteres para el producto: ${item.product?.name}`);
                    return;
                }
            }
        }

        setActionLoading(true);
        try {
            const res = await fetch(`/api/transfers/${selectedTransfer.id}/receive`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ itemsData })
            });
            if (res.ok) {
                alert("Mercadería recibida correctamente. El stock ha sido actualizado.");
                setModalMode(null);
                setSelectedTransfer(null);
                fetchData();
            } else {
                const data = await res.json();
                alert(data.error || "Error al recibir mercadería");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(false);
        }
    };

    const handleEntrySubmit = async () => {
        // Validation
        const unmapped = entryData.items.some((i: any) => !i.productId);
        if (unmapped) {
            alert("Debes vincular todos los productos detectados al catálogo antes de guardar.");
            return;
        }

        setActionLoading(true);
        try {
            const res = await fetch("/api/stock-entries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    branchId: userBranchId,
                    supplierName: entryData.supplierName,
                    invoiceNumber: entryData.invoiceNumber,
                    totalAmount: entryData.totalAmount,
                    notes: entryData.notes,
                    items: entryData.items,
                    updateBasePrices: true // Podemos hacerlo configurable en el futuro
                })
            });

            if (res.ok) {
                alert("Ingreso de stock realizado con éxito.");
                setModalMode(null);
                setEntryData({ items: [] });
                fetchData();
            } else {
                const data = await res.json();
                alert(data.error || "Error al realizar el ingreso");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(false);
        }
    };

    if (!enabled) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                <Info className="w-12 h-12 text-blue-500 mb-4" />
                <h2 className="text-xl font-bold text-gray-900">Módulo Desactivado</h2>
                <p className="text-gray-500 max-w-sm text-center mt-2">
                    El sistema de logística no está habilitado actualmente.
                    Contacte con un administrador para activarlo desde Configuración.
                </p>
                {isAdmin && (
                    <Link href="/configuracion" className="mt-6 btn btn-primary">
                        Ir a Configuración
                    </Link>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                        <Truck className="w-8 h-8 text-blue-600" />
                        Logística y Traspasos
                    </h1>
                    <p className="text-gray-500">Control de mercadería entre sucursales</p>
                </div>

                <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1">
                    <button
                        onClick={() => setActiveTab("outgoing")}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === "outgoing" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:bg-gray-200"}`}
                    >
                        <ArrowUpRight className="w-4 h-4" /> Mis Envíos
                    </button>
                    <button
                        onClick={() => setActiveTab("incoming")}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === "incoming" ? "bg-white shadow-sm text-green-600" : "text-gray-500 hover:bg-gray-200"}`}
                    >
                        <ArrowDownLeft className="w-4 h-4" /> Por Recibir
                    </button>
                    <button
                        onClick={() => setActiveTab("history")}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${activeTab === "history" ? "bg-white shadow-sm text-gray-600" : "text-gray-500 hover:bg-gray-200"}`}
                    >
                        <Clock className="w-4 h-4" /> Historial
                    </button>
                    <button
                        onClick={() => { setModalMode("entry"); setEntryStep(1); setEntryData({ items: [] }); }}
                        className="ml-2 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 transition"
                    >
                        <Package className="w-4 h-4" /> Nuevo Ingreso
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="py-20 text-center text-gray-400 font-bold animate-pulse uppercase tracking-widest">
                    Cargando movimientos...
                </div>
            ) : (
                <div className="card overflow-hidden p-0 border border-gray-100 shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs text-gray-500 font-bold uppercase tracking-wider text-left">
                                <tr>
                                    <th className="px-6 py-4">ID/Fecha</th>
                                    <th className="px-6 py-4">{activeTab === "outgoing" ? "Destino" : "Origen"}</th>
                                    <th className="px-6 py-4">Items</th>
                                    <th className="px-6 py-4 text-center">Estado</th>
                                    <th className="px-6 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {filteredMovements.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-12 text-gray-400 italic font-medium">
                                            No se encontraron movimientos.
                                        </td>
                                    </tr>
                                ) : filteredMovements.map((m: any) => (
                                    <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-gray-900">{m.type === 'entry' ? `Ingreso #${m.number}` : `Vale #${m.number}`}</p>
                                            <p className="text-[10px] text-gray-400 uppercase font-black">{formatDateTime(m.createdAt)}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${m.type === 'entry' ? "bg-purple-500" : activeTab === "outgoing" ? "bg-blue-500" : "bg-green-500"}`} />
                                                <span className="font-bold text-gray-700">
                                                    {m.type === 'entry' ? (m.supplierName || "Proveedor") :
                                                        activeTab === "outgoing" ? m.targetBranch?.name : m.sourceBranch?.name}
                                                </span>
                                            </div>
                                            {m.type === 'entry' && m.invoiceNumber && (
                                                <p className="text-[10px] text-gray-400 font-bold mt-0.5">DOC: {m.invoiceNumber}</p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5">
                                                <Package className="w-4 h-4 text-gray-300" />
                                                <span className="font-medium text-gray-600">{m.items?.length || 0} productos</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${m.type === 'entry' ? "bg-purple-100 text-purple-700" :
                                                m.status === "COMPLETADO" ? "bg-green-100 text-green-700" :
                                                    m.status === "EN_TRANSITO" ? "bg-blue-100 text-blue-700" :
                                                        m.status === "PENDIENTE" ? "bg-yellow-100 text-yellow-700" :
                                                            "bg-red-100 text-red-700"
                                                }`}>
                                                {m.type === 'entry' ? "RECIBIDO" : m.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {m.type === 'transfer' ? (
                                                    <>
                                                        <button
                                                            onClick={() => { setSelectedTransfer(m); setModalMode("view"); }}
                                                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition"
                                                            title="Ver Vale"
                                                        >
                                                            <Eye className="w-5 h-5" />
                                                        </button>

                                                        {activeTab === "outgoing" && m.status === "PENDIENTE" && (
                                                            <button
                                                                onClick={() => { setSelectedTransfer(m); setModalMode("emit"); }}
                                                                className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition"
                                                                title="Enviar Mercadería"
                                                            >
                                                                <Send className="w-5 h-5" />
                                                            </button>
                                                        )}

                                                        {activeTab === "incoming" && m.status === "EN_TRANSITO" && (
                                                            <button
                                                                onClick={() => {
                                                                    const initialItemsData: any = {};
                                                                    m.items.forEach((item: any) => {
                                                                        initialItemsData[item.id] = { receivedQuantity: item.quantity, justification: "" };
                                                                    });
                                                                    setItemsData(initialItemsData);
                                                                    setSelectedTransfer(m);
                                                                    setModalMode("receive");
                                                                }}
                                                                className="p-2 hover:bg-green-50 text-green-600 rounded-lg transition"
                                                                title="Confirmar Recepción"
                                                            >
                                                                <CheckCircle2 className="w-5 h-5" />
                                                            </button>
                                                        )}
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            // A futuro: Modal de detalle de ingreso
                                                            alert(`Ingreso de stock #${m.number}\nProveedor: ${m.supplierName || 'N/A'}\nTotal: $${m.totalAmount || 0}`);
                                                        }}
                                                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition"
                                                        title="Ver Detalle"
                                                    >
                                                        <Info className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL PARA DETALLES / ACCIONES DE TRASPASOS */}
            {modalMode && modalMode !== "entry" && selectedTransfer && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${modalMode === "emit" ? "bg-blue-100 text-blue-600" :
                                    modalMode === "receive" ? "bg-green-100 text-green-600" :
                                        "bg-gray-100 text-gray-600"
                                    }`}>
                                    <Package className="w-6 h-6" />
                                </div>
                                Vale de Traspaso #{selectedTransfer.number}
                            </h2>
                            <button onClick={() => setModalMode(null)} className="p-2 hover:bg-gray-100 rounded-full transition">&times;</button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Origen</p>
                                <p className="font-bold text-gray-800">{selectedTransfer.sourceBranch?.name}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Destino</p>
                                <p className="font-bold text-gray-800">{selectedTransfer.targetBranch?.name}</p>
                            </div>
                        </div>

                        <div className="bg-gray-50/50 p-6 rounded-3xl border border-gray-100 mb-8">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Info className="w-3 h-3 text-blue-500" /> Seguimiento del Proceso
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                                        {selectedTransfer.createdBy?.name?.charAt(0) || "U"}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase leading-none mb-1">Solicitó</p>
                                        <p className="text-xs font-bold text-gray-700">{selectedTransfer.createdBy?.name || "Sistema"}</p>
                                    </div>
                                </div>
                                {selectedTransfer.shippedBy && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xs">
                                            {selectedTransfer.shippedBy.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-orange-400 uppercase leading-none mb-1">Despachó</p>
                                            <p className="text-xs font-bold text-gray-700">{selectedTransfer.shippedBy.name}</p>
                                        </div>
                                    </div>
                                )}
                                {selectedTransfer.confirmedBy && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xs">
                                            {selectedTransfer.confirmedBy.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-green-400 uppercase leading-none mb-1">Recibió</p>
                                            <p className="text-xs font-bold text-gray-700">{selectedTransfer.confirmedBy.name}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto mb-6 pr-2 custom-scrollbar">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 block italic">Detalle de Mercería</label>
                            <div className="border border-gray-100 rounded-3xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-500 text-left border-b">
                                        <tr>
                                            <th className="px-5 py-3">Producto</th>
                                            <th className="px-5 py-3 text-right">Cantidad Env.</th>
                                            {modalMode === "receive" && <th className="px-5 py-3 text-right">Recibido</th>}
                                            {selectedTransfer.status === "COMPLETADO" && <th className="px-5 py-3 text-right">Recibido</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {selectedTransfer.items.map((item: any) => {
                                            const itemState = (itemsData as any)[item.id] || { receivedQuantity: item.quantity, justification: "" };
                                            const hasDifference = Number(itemState.receivedQuantity) !== Number(item.quantity);

                                            return (
                                                <tr key={item.id} className={hasDifference && modalMode === "receive" ? "bg-orange-50/30" : ""}>
                                                    <td className="px-5 py-4">
                                                        <p className="font-bold text-gray-900 leading-tight">{item.product?.name}</p>
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{item.product?.code}</p>

                                                        {modalMode === "receive" && hasDifference && (
                                                            <div className="mt-2 animate-in slide-in-from-top-1 duration-200 flex flex-col gap-2">
                                                                <div>
                                                                    <p className="text-[10px] font-bold text-orange-500 uppercase mb-1 flex items-center gap-1">
                                                                        <AlertTriangle className="w-3 h-3" /> Justificar diferencia
                                                                    </p>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Ej: Llegó roto, envase abierto..."
                                                                        className="w-full bg-white border border-orange-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-orange-500 outline-none"
                                                                        value={itemState.justification || ""}
                                                                        onChange={(e) => {
                                                                            const newData = { ...itemsData };
                                                                            (newData as any)[item.id] = { ...itemState, justification: e.target.value };
                                                                            setItemsData(newData);
                                                                        }}
                                                                    />
                                                                </div>

                                                                <div className="flex items-center gap-3">
                                                                    <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition cursor-pointer ${itemState.photoUrl ? "bg-green-50 border-green-200 text-green-700" : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"}`}>
                                                                        <Camera className="w-4 h-4" />
                                                                        <span className="text-[10px] font-bold uppercase">{uploading === item.id ? "Subiendo..." : itemState.photoUrl ? "Foto Lista" : "Subir Foto"}</span>
                                                                        <input
                                                                            type="file"
                                                                            accept="image/*"
                                                                            className="hidden"
                                                                            capture="environment"
                                                                            onChange={(e) => {
                                                                                const file = e.target.files?.[0];
                                                                                if (file) handleUpload(item.id, file);
                                                                            }}
                                                                            disabled={uploading === item.id}
                                                                        />
                                                                    </label>
                                                                    {itemState.photoUrl && (
                                                                        <a href={itemState.photoUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                                                                            <Eye className="w-3 h-3" /> Ver Foto
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {(selectedTransfer.status === "COMPLETADO" || selectedTransfer.status === "EN_TRANSITO") && (item.receptionJustification || item.receptionPhotoUrl) && (
                                                            <div className="mt-2 p-2 bg-gray-50 rounded-lg text-xs italic text-gray-500 flex flex-col gap-2">
                                                                {item.receptionJustification && (
                                                                    <div>
                                                                        <span className="font-bold uppercase text-[9px] block mb-0.5 text-gray-400">Nota de recepción:</span>
                                                                        "{item.receptionJustification}"
                                                                    </div>
                                                                )}
                                                                {item.receptionPhotoUrl && (
                                                                    <a href={item.receptionPhotoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-600 font-bold hover:underline">
                                                                        <Camera className="w-3.5 h-3.5" />
                                                                        <span>Ver evidencia fotográfica</span>
                                                                    </a>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-right font-mono font-bold text-gray-600">
                                                        {formatStock(item.quantity, item.product?.baseUnit)}
                                                    </td>
                                                    {modalMode === "receive" && (
                                                        <td className="px-5 py-4 text-right">
                                                            <div className="flex flex-col items-end gap-1">
                                                                <input
                                                                    type="number"
                                                                    className={`w-24 text-right font-mono font-bold bg-white border ${hasDifference ? "border-orange-300 bg-orange-50" : "border-gray-200"} rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500`}
                                                                    value={itemState.receivedQuantity}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                                                        const newData = { ...itemsData };
                                                                        (newData as any)[item.id] = { ...itemState, receivedQuantity: val };
                                                                        setItemsData(newData);
                                                                    }}
                                                                />
                                                                <span className="text-[10px] text-gray-400 font-bold uppercase">{item.product?.baseUnit}</span>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {selectedTransfer.status === "COMPLETADO" && (
                                                        <td className="px-5 py-4 text-right font-mono font-bold text-green-600">
                                                            {formatStock(item.receivedQuantity, item.product?.baseUnit)}
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {selectedTransfer.notes && (
                                <div className="mt-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                        <Info className="w-3 h-3" /> Notas del traspaso
                                    </p>
                                    <p className="text-sm text-blue-900 font-medium">{selectedTransfer.notes}</p>
                                </div>
                            )}
                        </div>

                        {modalMode === "emit" && (
                            <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 mb-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-200">
                                        <Send className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-blue-900">Confirmar Envío</h3>
                                        <p className="text-sm text-blue-700 opacity-80 leading-tight">
                                            Al confirmar, el stock se descontará de esta sucursal y el vale pasará a estar "En Tránsito".
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleEmit}
                                    disabled={actionLoading}
                                    className="w-full mt-6 btn bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-100 font-bold h-14 rounded-2xl flex items-center justify-center gap-2 group transition-all"
                                >
                                    {actionLoading ? "Procesando..." : (
                                        <>
                                            Enviar Mercadería
                                            <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {modalMode === "receive" && (
                            <div className="bg-green-50 p-6 rounded-3xl border border-green-100 mb-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-green-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-green-200">
                                        <CheckCircle className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-green-900">Confirmar Recepción</h3>
                                        <p className="text-sm text-green-700 opacity-80 leading-tight">
                                            Has recibido la mercadería físicamente. Al confirmar, el stock se incrementará en esta sucursal.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleReceive}
                                    disabled={actionLoading}
                                    className="w-full mt-6 btn bg-green-600 text-white hover:bg-green-700 shadow-xl shadow-green-100 font-bold h-14 rounded-2xl flex items-center justify-center gap-2 group transition-all"
                                >
                                    {actionLoading ? "Procesando..." : (
                                        <>
                                            Confirmar Todo Recibido
                                            <CheckCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-3">
                            <button onClick={() => setModalMode(null)} className="btn bg-gray-100 text-gray-600 hover:bg-gray-200 font-bold h-14 rounded-2xl border-none">
                                {modalMode === "view" ? "Cerrar" : "Cancelar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {modalMode === "entry" && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-4xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                                    <Package className="w-6 h-6" />
                                </div>
                                Ingreso Directo de Proveedor
                            </h2>
                            <button onClick={() => setModalMode(null)} className="p-2 hover:bg-gray-100 rounded-full transition">&times;</button>
                        </div>

                        {/* STEPS INDICATOR */}
                        <div className="flex items-center gap-2 mb-8">
                            {[1, 2, 3, 4].map(step => (
                                <div key={step} className="flex items-center gap-2 flex-1">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${entryStep >= step ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"}`}>
                                        {step}
                                    </div>
                                    <div className={`h-1 flex-1 rounded-full ${entryStep > step ? "bg-blue-600" : "bg-gray-100"}`} />
                                </div>
                            ))}
                        </div>

                        <div className="flex-1 overflow-auto mb-8 pr-2 custom-scrollbar">
                            {/* STEP 1: COMPROBANTE (OPCIONAL) */}
                            {entryStep === 1 && (
                                <div className="space-y-8 py-4">
                                    <div className="text-center max-w-md mx-auto">
                                        <h3 className="text-xl font-bold text-gray-900 mb-2">¿Tienes el comprobante?</h3>
                                        <p className="text-gray-500 text-sm">Puedes subir una foto para que el asistente intente leer los datos automáticamente o cargar todo a mano.</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="border-2 border-dashed border-blue-200 bg-blue-50/30 rounded-3xl p-10 flex flex-col items-center justify-center text-center group hover:border-blue-400 transition-all cursor-pointer relative">
                                            <input
                                                type="file"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                accept="image/*"
                                                capture="environment"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        setOcrProcessing(true);
                                                        try {
                                                            const result = await processInvoiceImage(file);
                                                            if (result) {
                                                                // Populate data
                                                                const newEntryData = {
                                                                    ...entryData,
                                                                    invoiceFile: file,
                                                                    supplierName: result.supplierName || entryData.supplierName,
                                                                    invoiceNumber: result.invoiceNumber || entryData.invoiceNumber,
                                                                    totalAmount: result.totalAmount || entryData.totalAmount,
                                                                    items: [] as any[]
                                                                };

                                                                // Auto-match items if possible (Future enhancement: more robust matching)
                                                                // For now we add them as items to be matched by the user or simple catalog search
                                                                if (result.items.length > 0) {
                                                                    for (const item of result.items) {
                                                                        const searchRes = await fetch(`/api/products?search=${encodeURIComponent(item.name)}`);
                                                                        const searchData = await searchRes.json();

                                                                        if (searchData.products?.length > 0) {
                                                                            const p = searchData.products[0];
                                                                            newEntryData.items.push({
                                                                                productId: p.id,
                                                                                name: p.name,
                                                                                code: p.code,
                                                                                basePrice: Number(p.basePrice),
                                                                                quantity: item.quantity,
                                                                                costPrice: item.costPrice,
                                                                                updatePrice: false
                                                                            });
                                                                        } else {
                                                                            // ADD AS UNMAPPED ITEM
                                                                            newEntryData.items.push({
                                                                                productId: null, // Marks as unmapped
                                                                                name: item.name,
                                                                                code: 'PENDIENTE',
                                                                                basePrice: 0,
                                                                                quantity: item.quantity,
                                                                                costPrice: item.costPrice,
                                                                                updatePrice: false
                                                                            });
                                                                        }
                                                                    }
                                                                }

                                                                setEntryData(newEntryData);
                                                                setEntryStep(2);
                                                            } else {
                                                                setEntryData({ ...entryData, invoiceFile: file });
                                                                setEntryStep(2);
                                                            }
                                                        } catch (error) {
                                                            console.error("Error in OCR:", error);
                                                            setEntryStep(2);
                                                        } finally {
                                                            setOcrProcessing(false);
                                                        }
                                                    }
                                                }}
                                            />
                                            <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform mb-4">
                                                {ocrProcessing ? (
                                                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Camera className="w-8 h-8" />
                                                )}
                                            </div>
                                            <h4 className="font-bold text-blue-900 mb-1">{ocrProcessing ? "Leyendo Comprobante..." : "Subir Foto / Escanear"}</h4>
                                            <p className="text-xs text-blue-600/60 font-medium">{ocrProcessing ? "Iniciando IA Tesseract..." : "Asistente con OCR (Lectura IA)"}</p>
                                        </div>

                                        <div
                                            onClick={() => setEntryStep(2)}
                                            className="border-2 border-gray-100 bg-gray-50/50 rounded-3xl p-10 flex flex-col items-center justify-center text-center hover:border-gray-200 transition-all cursor-pointer group"
                                        >
                                            <div className="w-16 h-16 bg-white border border-gray-200 text-gray-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                                <XCircle className="w-8 h-8" />
                                            </div>
                                            <h4 className="font-bold text-gray-900 mb-1">Cargar Manualmente</h4>
                                            <p className="text-xs text-gray-400 font-medium">Sin comprobante o ilegible</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: DATOS GENERALES */}
                            {entryStep === 2 && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Proveedor (Opcional)</label>
                                            <input
                                                type="text"
                                                className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl px-5 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition"
                                                placeholder="Nombre del proveedor..."
                                                value={entryData.supplierName || ""}
                                                onChange={(e) => setEntryData({ ...entryData, supplierName: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Número de Factura</label>
                                            <input
                                                type="text"
                                                className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl px-5 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition"
                                                placeholder="0001-XXXXXXXX"
                                                value={entryData.invoiceNumber || ""}
                                                onChange={(e) => setEntryData({ ...entryData, invoiceNumber: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Total del Comprobante</label>
                                            <div className="relative">
                                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                                <input
                                                    type="number"
                                                    className="w-full h-14 bg-blue-50 border border-blue-100 rounded-2xl pl-10 pr-5 font-black text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none transition text-xl"
                                                    placeholder="0.00"
                                                    value={entryData.totalAmount || ""}
                                                    onChange={(e) => setEntryData({ ...entryData, totalAmount: Number(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Notas Internas</label>
                                            <textarea
                                                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition h-14 min-h-[56px] resize-none"
                                                placeholder="Detalles adicionales..."
                                                value={entryData.notes || ""}
                                                onChange={(e) => setEntryData({ ...entryData, notes: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: ITEMS Y COMPARACIÓN */}
                            {entryStep === 3 && (
                                <div className="space-y-6">
                                    <div className="bg-blue-600 rounded-2xl p-6 text-white flex justify-between items-center shadow-xl shadow-blue-100 mb-6">
                                        <div className="flex-1">
                                            <h4 className="text-xs font-black uppercase tracking-widest opacity-70 mb-1">Total del Comprobante</h4>
                                            <div className="flex items-center gap-2">
                                                <span className="text-3xl font-black italic">$</span>
                                                <input
                                                    type="number"
                                                    className="bg-transparent border-none text-3xl font-black italic focus:ring-0 w-full p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    value={entryData.totalAmount || 0}
                                                    onChange={(e) => setEntryData({ ...entryData, totalAmount: Number(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                        <Package className="w-12 h-12 opacity-20" />
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-black text-gray-900 uppercase tracking-widest">Productos Ingresados</label>
                                            <div className="relative group min-w-[300px]">
                                                <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${itemSearch ? 'text-blue-500' : 'text-gray-400'}`} />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar por código o nombre..."
                                                    className="w-full h-11 pl-11 pr-4 bg-white border border-gray-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-50 focus:border-blue-400 transition-all outline-none shadow-sm"
                                                    value={itemSearch}
                                                    onChange={(e) => setItemSearch(e.target.value)}
                                                />

                                                {/* RESULTADOS DE BUSQUEDA FLOTANTES */}
                                                {itemSearchResults.length > 0 && (
                                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                                                        <div className="max-h-60 overflow-y-auto">
                                                            {itemSearchResults.map((p: any) => (
                                                                <button
                                                                    key={p.id}
                                                                    onClick={() => {
                                                                        const newItems = [...(entryData.items || [])];
                                                                        newItems.push({
                                                                            productId: p.id,
                                                                            name: p.name,
                                                                            code: p.code,
                                                                            basePrice: Number(p.basePrice),
                                                                            quantity: 1,
                                                                            costPrice: Number(p.basePrice),
                                                                            updatePrice: false
                                                                        });
                                                                        setEntryData({ ...entryData, items: newItems });
                                                                        setItemSearch("");
                                                                        setItemSearchResults([]);
                                                                    }}
                                                                    className="w-full p-4 flex items-center justify-between hover:bg-blue-50 text-left transition"
                                                                >
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-0.5">{p.code}</span>
                                                                        <span className="text-sm font-bold text-gray-900">{p.name}</span>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Precio Base</span>
                                                                        <span className="text-sm font-black text-gray-900">$ {p.basePrice}</span>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {itemSearch.length >= 2 && itemSearchResults.length === 0 && !searchLoading && (
                                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl p-4 shadow-2xl z-50 text-center animate-in slide-in-from-top-2">
                                                        <p className="text-xs font-bold text-gray-400 italic mb-2">No se encontró el producto</p>
                                                        <button
                                                            onClick={() => {
                                                                const newIdx = entryData.items.length;
                                                                const newItems = [...entryData.items, {
                                                                    name: itemSearch,
                                                                    code: 'PENDIENTE',
                                                                    productId: null,
                                                                    quantity: 1,
                                                                    costPrice: 0,
                                                                    basePrice: 0,
                                                                    updatePrice: false,
                                                                    minStock: 0,
                                                                    categoryId: null,
                                                                    baseUnitId: null,
                                                                    sellingPrice: 0
                                                                }];
                                                                setEntryData({ ...entryData, items: newItems });
                                                                setCreatingProductFor(newIdx);
                                                                setItemSearch("");
                                                            }}
                                                            className="text-xs font-black text-blue-600 uppercase hover:underline"
                                                        >
                                                            + Crear como Nuevo
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="border border-gray-100 rounded-3xl overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-500 text-left border-b">
                                                    <tr>
                                                        <th className="px-5 py-3">Producto</th>
                                                        <th className="px-5 py-3 text-right">Cantidad</th>
                                                        <th className="px-5 py-3 text-right">Costo unit.</th>
                                                        <th className="px-5 py-3 text-center">Base</th>
                                                        <th className="px-5 py-3"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {entryData.items?.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={5} className="py-10 text-center text-gray-400 italic font-medium">No hay productos agregados.</td>
                                                        </tr>
                                                    ) : entryData.items.map((item: any, idx: number) => {
                                                        const isPriceDifferent = Math.abs(item.costPrice - item.basePrice) > 0.01;
                                                        return (
                                                            <tr key={idx} className={isPriceDifferent ? "bg-orange-50/20" : ""}>
                                                                <td className="px-5 py-4">
                                                                    <div className="flex flex-col">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className={`font-bold leading-tight ${!item.productId ? "text-red-500" : "text-gray-900"}`}>
                                                                                {item.name}
                                                                            </span>
                                                                            {item.productId && (
                                                                                <button
                                                                                    onClick={() => {
                                                                                        const newItems = [...entryData.items];
                                                                                        newItems[idx].productId = null;
                                                                                        newItems[idx].code = 'PENDIENTE';
                                                                                        setEntryData({ ...entryData, items: newItems });
                                                                                    }}
                                                                                    className="text-[9px] font-black text-gray-400 hover:text-blue-600 uppercase flex items-center gap-1 transition"
                                                                                >
                                                                                    <RefreshCcw className="w-2.5 h-2.5" /> Cambiar
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <span className={`text-[10px] font-bold uppercase ${!item.productId ? "text-red-400 bg-red-50 px-1 rounded" : "text-gray-400"}`}>
                                                                                {item.code}
                                                                            </span>
                                                                            {!item.productId && (
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setItemSearch(item.name);
                                                                                        // Eliminamos el item actual para que al elegir uno del buscador se "reemplace"
                                                                                        // O mejor: simplemente seteamos el search y dejamos que el usuario lo agregue arriba
                                                                                        // Pero para que sea un REEMPLAZO real, deberiamos saber que estamos editando un item.
                                                                                        // Por ahora, lo mas intuitivo es que el usuario busque y el buscador añada uno nuevo, y luego borre el viejo si quiere.
                                                                                        // O simplificamos: El boton "Vincular" ahora solo ayuda a buscar.
                                                                                        const searchEl = document.querySelector('input[placeholder="Buscar por código o nombre..."]') as HTMLInputElement;
                                                                                        if (searchEl) {
                                                                                            searchEl.focus();
                                                                                            searchEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                                        }
                                                                                    }}
                                                                                    className="text-[9px] font-black text-blue-600 uppercase hover:underline"
                                                                                >
                                                                                    Vincular a catálogo
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                        {!item.productId && (
                                                                            <div className="mt-2 flex items-center gap-2 animate-in slide-in-from-top-1 duration-200">
                                                                                <div className="relative group flex-1">
                                                                                    <input
                                                                                        type="text"
                                                                                        placeholder="EAN / Escanear..."
                                                                                        className="w-full h-8 bg-white border border-red-100 rounded-lg px-2 text-[10px] font-bold focus:ring-1 focus:ring-red-300 outline-none"
                                                                                        value={item.ean || ""}
                                                                                        onChange={(e) => {
                                                                                            const items = [...entryData.items];
                                                                                            items[idx].ean = e.target.value;
                                                                                            setEntryData({ ...entryData, items });
                                                                                        }}
                                                                                    />
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            if (!item.ean) return;
                                                                                            fetch(`/api/products?search=${item.ean}`)
                                                                                                .then(r => r.json())
                                                                                                .then(data => {
                                                                                                    if (data.products?.length > 0) {
                                                                                                        const p = data.products[0];
                                                                                                        const newItems = [...entryData.items];
                                                                                                        newItems[idx] = {
                                                                                                            ...newItems[idx],
                                                                                                            productId: p.id,
                                                                                                            name: p.name,
                                                                                                            code: p.code,
                                                                                                            basePrice: Number(p.basePrice)
                                                                                                        };
                                                                                                        setEntryData({ ...entryData, items: newItems });
                                                                                                    } else {
                                                                                                        alert("No se encontró producto con ese EAN.");
                                                                                                    }
                                                                                                });
                                                                                        }}
                                                                                        className="absolute right-1 top-1 text-red-500 hover:text-red-700"
                                                                                    >
                                                                                        <Send className="w-4 h-4" />
                                                                                    </button>
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => setCreatingProductFor(idx)}
                                                                                    className="h-8 px-2 bg-green-50 text-green-600 rounded-lg text-[9px] font-black uppercase hover:bg-green-100"
                                                                                >
                                                                                    + Nuevo
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-4 text-right">
                                                                    <input
                                                                        type="number"
                                                                        className="w-20 text-right bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 font-bold outline-none"
                                                                        value={item.quantity}
                                                                        onChange={(e) => {
                                                                            const items = [...entryData.items];
                                                                            items[idx].quantity = Number(e.target.value);
                                                                            setEntryData({ ...entryData, items });
                                                                        }}
                                                                    />
                                                                </td>
                                                                <td className="px-5 py-4 text-right">
                                                                    <div className="flex flex-col items-end">
                                                                        <input
                                                                            type="number"
                                                                            className={`w-24 text-right bg-white border ${isPriceDifferent ? "border-orange-300 ring-2 ring-orange-100" : "border-gray-100"} rounded-lg px-2 py-1 font-bold outline-none`}
                                                                            value={item.costPrice}
                                                                            onChange={(e) => {
                                                                                const items = [...entryData.items];
                                                                                items[idx].costPrice = Number(e.target.value);
                                                                                setEntryData({ ...entryData, items });
                                                                            }}
                                                                        />
                                                                        {isPriceDifferent && (
                                                                            <span className="text-[9px] font-black text-orange-500 uppercase mt-1">Costo varió</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-4 text-center">
                                                                    <div className="flex flex-col items-center gap-2">
                                                                        <span className="text-xs font-mono font-bold text-gray-400">$ {item.basePrice}</span>
                                                                        {isPriceDifferent && (
                                                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className="toggle toggle-xs toggle-primary"
                                                                                    checked={item.updatePrice}
                                                                                    onChange={(e) => {
                                                                                        const items = [...entryData.items];
                                                                                        items[idx].updatePrice = e.target.checked;
                                                                                        setEntryData({ ...entryData, items });
                                                                                    }}
                                                                                />
                                                                                <span className="text-[9px] font-bold text-blue-600 uppercase">Actualizar</span>
                                                                            </label>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-4 text-right">
                                                                    <button
                                                                        onClick={() => {
                                                                            const items = entryData.items.filter((_: any, i: number) => i !== idx);
                                                                            setEntryData({ ...entryData, items });
                                                                        }}
                                                                        className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition"
                                                                    >
                                                                        <XCircle className="w-5 h-5" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* MODAL PARA CREAR PRODUCTO NUEVO RAPIDO */}
                                        {creatingProductFor !== null && (
                                            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                                                <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                                                    <h3 className="text-xl font-bold text-gray-900 mb-6">Crear Nuevo Producto</h3>
                                                    <div className="space-y-4">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nombre del Producto</label>
                                                            <input
                                                                type="text"
                                                                className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-4 font-bold"
                                                                value={entryData.items[creatingProductFor]?.name || ""}
                                                                onChange={(e) => {
                                                                    const items = [...entryData.items];
                                                                    items[creatingProductFor].name = e.target.value;
                                                                    setEntryData({ ...entryData, items });
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">EAN / Código de Barras</label>
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    className="flex-1 h-12 bg-gray-50 border border-gray-100 rounded-xl px-4 font-bold font-mono"
                                                                    placeholder="Escanear o ingresar..."
                                                                    value={entryData.items[creatingProductFor]?.ean || ""}
                                                                    onChange={(e) => {
                                                                        const items = [...entryData.items];
                                                                        items[creatingProductFor].ean = e.target.value;
                                                                        setEntryData({ ...entryData, items });
                                                                    }}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const code = `INT${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`;
                                                                        const items = [...entryData.items];
                                                                        items[creatingProductFor].ean = code;
                                                                        setEntryData({ ...entryData, items });
                                                                    }}
                                                                    className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-bold text-xs transition"
                                                                >
                                                                    Generar
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Stock Mínimo</label>
                                                                <input
                                                                    type="number"
                                                                    className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-4 font-bold"
                                                                    placeholder="0"
                                                                    value={entryData.items[creatingProductFor]?.minStock || 0}
                                                                    onChange={(e) => {
                                                                        const items = [...entryData.items];
                                                                        items[creatingProductFor].minStock = Number(e.target.value);
                                                                        setEntryData({ ...entryData, items });
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Unidad Base</label>
                                                                <select
                                                                    className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-4 font-bold appearance-none"
                                                                    value={entryData.items[creatingProductFor]?.baseUnitId || ""}
                                                                    onChange={(e) => {
                                                                        const items = [...entryData.items];
                                                                        items[creatingProductFor].baseUnitId = e.target.value;
                                                                        setEntryData({ ...entryData, items });
                                                                    }}
                                                                >
                                                                    <option value="">Seleccionar...</option>
                                                                    {units.map((u: any) => (
                                                                        <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Categoría</label>
                                                            <select
                                                                className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-4 font-bold appearance-none"
                                                                value={entryData.items[creatingProductFor]?.categoryId || ""}
                                                                onChange={(e) => {
                                                                    const items = [...entryData.items];
                                                                    items[creatingProductFor].categoryId = e.target.value;
                                                                    setEntryData({ ...entryData, items });
                                                                }}
                                                            >
                                                                <option value="">Sin categoría</option>
                                                                {categories.map((c: any) => (
                                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-blue-600">Precio de Venta Sug.</label>
                                                                <input
                                                                    type="number"
                                                                    className="w-full h-12 bg-blue-50 border border-blue-100 rounded-xl px-4 font-bold text-blue-700"
                                                                    placeholder="1000"
                                                                    value={entryData.items[creatingProductFor]?.sellingPrice || ""}
                                                                    onChange={(e) => {
                                                                        const items = [...entryData.items];
                                                                        items[creatingProductFor].sellingPrice = Number(e.target.value);
                                                                        setEntryData({ ...entryData, items });
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Precio Base (Costo)</label>
                                                                <div className="relative">
                                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                                                                    <input
                                                                        type="number"
                                                                        className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl pl-8 pr-4 font-bold"
                                                                        value={entryData.items[creatingProductFor]?.costPrice || ""}
                                                                        onChange={(e) => {
                                                                            const items = [...entryData.items];
                                                                            items[creatingProductFor].costPrice = Number(e.target.value);
                                                                            setEntryData({ ...entryData, items });
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex gap-3 pt-4">
                                                            <button
                                                                onClick={() => setCreatingProductFor(null)}
                                                                className="flex-1 h-12 rounded-xl font-bold text-gray-400 hover:bg-gray-50 transition"
                                                            >
                                                                Cancelar
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    const item = entryData.items[creatingProductFor];
                                                                    if (!item.name || !item.ean) {
                                                                        alert("Nombre y EAN son obligatorios");
                                                                        return;
                                                                    }
                                                                    setActionLoading(true);
                                                                    try {
                                                                        const res = await fetch("/api/products", {
                                                                            method: "POST",
                                                                            headers: { "Content-Type": "application/json" },
                                                                            body: JSON.stringify({
                                                                                name: item.name,
                                                                                ean: item.ean,
                                                                                code: item.ean,
                                                                                basePrice: item.sellingPrice || item.costPrice,
                                                                                minStock: item.minStock || 0,
                                                                                categoryId: item.categoryId || null,
                                                                                baseUnitId: item.baseUnitId || null
                                                                            })
                                                                        });
                                                                        if (res.ok) {
                                                                            const prod = await res.json();
                                                                            const newItems = [...entryData.items];
                                                                            newItems[creatingProductFor] = {
                                                                                ...newItems[creatingProductFor],
                                                                                productId: prod.id,
                                                                                code: prod.code,
                                                                                basePrice: Number(prod.basePrice),
                                                                                updatePrice: false
                                                                            };
                                                                            setEntryData({ ...entryData, items: newItems });
                                                                            setCreatingProductFor(null);
                                                                        } else {
                                                                            const err = await res.json();
                                                                            alert(err.error || "Error al crear producto");
                                                                        }
                                                                    } catch (e) {
                                                                        console.error(e);
                                                                    } finally {
                                                                        setActionLoading(false);
                                                                    }
                                                                }}
                                                                className="flex-[2] h-12 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition"
                                                            >
                                                                Crear Producto
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* STEP 4: RESUMEN Y GUARDAR */}
                            {entryStep === 4 && (
                                <div className="space-y-8 text-center py-10">
                                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-green-50 animate-bounce">
                                        <CheckCircle2 className="w-10 h-10" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-gray-900 mb-2">¡Todo listo para cargar!</h3>
                                        <p className="text-gray-500 max-w-sm mx-auto">
                                            Se ingresarán **{entryData.items?.length || 0} productos** a la sucursal **{(session?.user as any)?.branch?.name}**.
                                            {entryData.items?.filter((i: any) => i.updatePrice).length > 0 && (
                                                <span className="block mt-2 font-bold text-blue-600">
                                                    Se actualizaron {entryData.items?.filter((i: any) => i.updatePrice).length} precios base globales.
                                                </span>
                                            )}
                                        </p>
                                    </div>

                                    <div className="bg-gray-50 rounded-3xl p-8 max-w-md mx-auto border border-gray-100 divide-y divide-gray-200">
                                        <div className="pb-4 flex justify-between">
                                            <span className="text-xs font-bold text-gray-400 uppercase">Proveedor</span>
                                            <span className="font-black text-gray-700">{entryData.supplierName || "No especificado"}</span>
                                        </div>
                                        <div className="py-4 flex justify-between">
                                            <span className="text-xs font-bold text-gray-400 uppercase">Comprobante</span>
                                            <span className="font-black text-gray-700">{entryData.invoiceNumber || "S/Comprobante"}</span>
                                        </div>
                                        <div className="pt-4 flex justify-between items-center text-blue-600">
                                            <span className="text-xs font-black uppercase">Total a Ingresar</span>
                                            <span className="text-2xl font-black italic">$ {Number(entryData.totalAmount || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* FOOTER ACCIONES */}
                        <div className="flex gap-4">
                            {entryStep > 1 && (
                                <button
                                    onClick={() => setEntryStep(entryStep - 1)}
                                    className="h-14 px-8 rounded-2xl bg-gray-100 text-gray-500 font-bold hover:bg-gray-200 transition"
                                >
                                    Atrás
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    if (entryStep < 4) {
                                        setEntryStep(entryStep + 1);
                                    } else {
                                        handleEntrySubmit();
                                    }
                                }}
                                disabled={actionLoading || (entryStep === 3 && (!entryData.items || entryData.items.length === 0))}
                                className={`flex-1 h-14 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl transition-all ${entryStep === 4 ? "bg-green-600 text-white shadow-green-100 hover:bg-green-700" : "bg-blue-600 text-white shadow-blue-100 hover:bg-blue-700"}`}
                            >
                                {actionLoading ? "Procesando..." : entryStep < 4 ? "Continuar" : "Confirmar e Ingresar Stock"}
                                {entryStep < 4 && <ArrowUpRight className="w-5 h-5 rotate-45" />}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

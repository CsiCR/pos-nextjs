"use client";
import { useState, useEffect } from "react";
import { Search, Calendar, User, Printer, Eye, ChevronLeft, ChevronRight, Hash, Clock, CreditCard, List, FileText, ArrowUpDown } from "lucide-react";
import { Ticket } from "@/components/Ticket";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatPrice, roundCurrency, formatDateTime, formatTime } from "@/lib/utils";
import { useSettings } from "@/hooks/use-settings";

export default function HistorialPage() {
    const { data: session } = useSession() || {};
    const { settings } = useSettings();
    const searchParams = useSearchParams();
    const router = useRouter();
    const shiftIdParam = searchParams.get("shiftId");
    const viewParam = searchParams.get("view");

    // View Mode: 'sales' (Tickets) or 'items' (Detailed Lines)
    const [viewMode, setViewMode] = useState<"sales" | "items">(viewParam === "items" ? "items" : "sales");

    const [sales, setSales] = useState<any[]>([]); // For Sales Mode
    const [items, setItems] = useState<any[]>([]); // For Items Mode
    const [loading, setLoading] = useState(true);

    const getLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [dateFilter, setDateFilter] = useState(searchParams.get("startDate") ? "custom" : "today");
    const [startDate, setStartDate] = useState(searchParams.get("startDate") || getLocalDate(new Date()));
    const [endDate, setEndDate] = useState(searchParams.get("endDate") || getLocalDate(new Date()));
    const [search, setSearch] = useState("");
    const [selectedSale, setSelectedSale] = useState<any>(null);

    // Sync view mode with URL
    useEffect(() => {
        if (viewParam === "items" && viewMode !== "items") setViewMode("items");
    }, [viewParam]);

    const [columnFilters, setColumnFilters] = useState({
        ticket: "",
        product: "",
        branch: searchParams.get("branchName") || "", // If passed by name, or we might need to fetch by ID if only ID passed. 
        // Dashboard passes branchId. The table column filter is by text name. 
        // Ideally we should sync these, but for now date persistence is the main request.
        seller: ""
    });

    const fetchData = async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (shiftIdParam) params.append("shiftId", shiftIdParam);
        else {
            params.append("startDate", startDate);
            params.append("endDate", endDate);
        }

        // General search
        if (search) params.append("search", search);

        // Column Filters (Text Based)
        if (columnFilters.ticket) params.append("ticketNumber", columnFilters.ticket);
        if (columnFilters.product) params.append("productName", columnFilters.product);
        if (columnFilters.branch) params.append("branchName", columnFilters.branch);
        if (columnFilters.seller) params.append("sellerName", columnFilters.seller);

        // Dashboard Links Filters (ID Based)
        const urlBranch = searchParams.get("branchId");
        if (urlBranch) params.append("branchId", urlBranch);

        const urlUser = searchParams.get("userId");
        if (urlUser) params.append("userId", urlUser);

        const paymentMethod = searchParams.get("paymentMethod");
        if (paymentMethod) params.append("paymentMethod", paymentMethod);

        let url = "";
        if (viewMode === "sales") {
            url = `/api/sales?${params.toString()}`;
            const res = await fetch(url);
            const data = await res.json();
            setSales(data || []);
        } else {
            url = `/api/sales/items?${params.toString()}`;
            const res = await fetch(url);
            const data = await res.json();
            setItems(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData();
        }, 500); // Debounce filters
        return () => clearTimeout(timer);
    }, [startDate, endDate, shiftIdParam, viewMode, search, columnFilters]); // Add columnFilters

    const handleDateShortcut = (type: string) => {
        const today = new Date();
        if (type === "today") {
            setStartDate(getLocalDate(today));
            setEndDate(getLocalDate(today));
        } else if (type === "yesterday") {
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            setStartDate(getLocalDate(yesterday));
            setEndDate(getLocalDate(yesterday));
        } else if (type === "week") {
            const lastWeek = new Date(today);
            lastWeek.setDate(today.getDate() - 7);
            setStartDate(getLocalDate(lastWeek));
            setEndDate(getLocalDate(today));
        }
        setDateFilter(type);
    };

    // Client-side filtering for Sales Mode (Items mode does server-side search)
    const filteredSales = sales.filter(s =>
        !search || // If search handled by API in sales mode? Current api/sales might not support search param.
        // Let's keep client filter for consistency if API doesn't support it, 
        // BUT API call above includes search param. Assuming existing api/sales ignores it or we rely on client.
        // Step 8 refactor: api/sales usually simple. Let's keep client filter safely.
        (s.number?.toString().includes(search) ||
            s.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
            s.total.toString().includes(search))
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800">
                        {shiftIdParam ? "Ventas del Turno" : "Historial"}
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <button
                            onClick={() => { setViewMode("sales"); router.replace("/historial?view=sales"); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition ${viewMode === "sales" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                        >
                            <FileText className="w-4 h-4" /> Por Comprobante
                        </button>
                        <button
                            onClick={() => { setViewMode("items"); router.replace("/historial?view=items"); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition ${viewMode === "items" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                        >
                            <List className="w-4 h-4" /> Por Ítem (Detalle)
                        </button>
                    </div>
                </div>

                {shiftIdParam ? (
                    <button
                        onClick={() => router.push("/historial")}
                        className="btn bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                        <ChevronLeft className="w-4 h-4" /> Volver al Historial General
                    </button>
                ) : (
                    <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border">
                        <button onClick={() => handleDateShortcut("today")} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${dateFilter === "today" ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-gray-500 hover:bg-gray-50"}`}>Hoy</button>
                        <button onClick={() => handleDateShortcut("yesterday")} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${dateFilter === "yesterday" ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-gray-500 hover:bg-gray-50"}`}>Ayer</button>
                        <button onClick={() => handleDateShortcut("week")} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${dateFilter === "week" ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-gray-500 hover:bg-gray-50"}`}>7 Días</button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Filters Sidebar */}
                <div className="card h-fit space-y-6">
                    <div>
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 block">Filtro por Fecha</label>
                        <div className="space-y-3">
                            <div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase ml-1">Desde</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={e => { setStartDate(e.target.value); setDateFilter("custom"); }}
                                    className="input input-sm mt-1"
                                />
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase ml-1">Hasta</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={e => { setEndDate(e.target.value); setDateFilter("custom"); }}
                                    className="input input-sm mt-1"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 block">Búsqueda Rápida</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder={viewMode === "items" ? "Global..." : "N° Venta o Cajero..."}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="input input-sm pl-9"
                            />
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="lg:col-span-3 space-y-4">
                    {loading && items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed text-gray-400">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                            <p>Cargando datos...</p>
                        </div>
                    ) : viewMode === "sales" ? (
                        // SALES CARD VIEW
                        filteredSales.length === 0 ? (
                            <EmptyState />
                        ) : (
                            <div className="grid gap-3">
                                {filteredSales.map(sale => (
                                    <div key={sale.id} className="group bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                                                <Hash className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-lg text-gray-800">#{sale.number || sale.id.slice(-6).toUpperCase()}</span>
                                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-bold uppercase">{sale.paymentMethod}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(sale.createdAt)}</span>
                                                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {sale.user?.name}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-8">
                                            <div className="text-right">
                                                {Number(sale.discount) > 0 ? (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger>
                                                                <p className="text-2xl font-black text-blue-600 cursor-help border-b border-dotted border-blue-300">
                                                                    {formatPrice(sale.total, settings.useDecimals)}
                                                                </p>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <div className="text-xs">
                                                                    <p>Subtotal: {formatPrice(Number(sale.total) + Number(sale.discount), settings.useDecimals)}</p>
                                                                    <p className="text-red-500">Descuento: -{formatPrice(sale.discount, settings.useDecimals)}</p>
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                ) : (
                                                    <p className="text-2xl font-black text-blue-600">{formatPrice(sale.total, settings.useDecimals)}</p>
                                                )}
                                                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tighter">{sale.items?.length || 0} ítems</p>
                                            </div>
                                            <button onClick={() => setSelectedSale(sale)} className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-blue-600 hover:text-white transition-colors">
                                                <Printer className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        // ITEMS TABLE VIEW
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-100 text-xs font-black text-gray-500 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4">Comprobante</th>
                                            <th className="px-6 py-4">Fecha</th>
                                            <th className="px-6 py-4">Producto</th>
                                            <th className="px-6 py-4">Sucursal</th> {/* NEW COLUMN */}
                                            <th className="px-6 py-4 text-right">Cant.</th>
                                            <th className="px-6 py-4 text-right">Monto</th>
                                            <th className="px-6 py-4">Vendedor</th>
                                            <th className="px-6 py-4 text-center">Ticket</th>
                                        </tr>
                                        {/* FILTER ROW */}
                                        <tr className="bg-white border-b border-gray-100">
                                            <th className="px-6 py-2">
                                                <input className="input input-xs w-24" placeholder="Filtrar #" value={columnFilters.ticket} onChange={e => setColumnFilters({ ...columnFilters, ticket: e.target.value })} />
                                            </th>
                                            <th className="px-6 py-2"></th>
                                            <th className="px-6 py-2">
                                                <input className="input input-xs w-32" placeholder="Filtrar Producto" value={columnFilters.product} onChange={e => setColumnFilters({ ...columnFilters, product: e.target.value })} />
                                            </th>
                                            <th className="px-6 py-2">
                                                <input className="input input-xs w-24" placeholder="Filtrar Suc..." value={columnFilters.branch} onChange={e => setColumnFilters({ ...columnFilters, branch: e.target.value })} />
                                            </th>
                                            <th className="px-6 py-2"></th>
                                            <th className="px-6 py-2"></th>
                                            <th className="px-6 py-2">
                                                <input className="input input-xs w-24" placeholder="Filtrar Vend..." value={columnFilters.seller} onChange={e => setColumnFilters({ ...columnFilters, seller: e.target.value })} />
                                            </th>
                                            <th className="px-6 py-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {items.length === 0 ? (
                                            <tr><td colSpan={8} className="text-center py-8 text-gray-400">Sin resultados</td></tr>
                                        ) : items.map((item) => (
                                            <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="px-6 py-3 font-mono font-bold text-gray-600">
                                                    #{item.sale?.number || "N/A"}
                                                </td>
                                                <td className="px-6 py-3 text-gray-600">
                                                    {formatDateTime(item.sale?.createdAt)}
                                                </td>
                                                <td className="px-6 py-3 font-medium text-gray-900">
                                                    {item.product?.name || "Producto Eliminado"}
                                                </td>
                                                <td className="px-6 py-3 text-gray-600 uppercase text-xs"> {/* NEW COLUMN CELL */}
                                                    {item.sale?.branch?.name || "-"}
                                                </td>
                                                <td className="px-6 py-3 text-right font-mono">
                                                    {item.quantity}
                                                </td>
                                                <td className="px-6 py-3 text-right font-black text-blue-600">
                                                    {formatPrice(roundCurrency(item.price * item.quantity), settings.useDecimals)}
                                                </td>
                                                <td className="px-6 py-3 text-gray-500 text-xs uppercase">
                                                    {item.sale?.user?.name || "N/A"}
                                                </td>
                                                <td className="px-6 py-3 text-center">
                                                    <button
                                                        onClick={async () => {
                                                            // Need to fetch full sale for ticket? Or if item.sale has enough info?
                                                            // Ticket component usually needs full items list.
                                                            // We can just open the ticket modal and let it fetch or pass the sale ID.
                                                            // Current Ticket component takes `sale` object. 
                                                            // We might need to fetch the full sale details first.
                                                            if (item.sale?.id) {
                                                                setLoading(true);
                                                                const res = await fetch(`/api/sales/${item.sale.id}`);
                                                                if (res.ok) {
                                                                    const fullSale = await res.json();
                                                                    setSelectedSale(fullSale);
                                                                }
                                                                setLoading(false);
                                                            }
                                                        }}
                                                        className="text-gray-400 hover:text-blue-600 transition"
                                                        title="Ver Comprobante"
                                                    >
                                                        <Eye className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-4 border-t border-gray-100 bg-gray-50/50 text-center text-xs text-gray-400">
                                Mostrando {items.length} ítems
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {selectedSale && (
                <Ticket sale={selectedSale} onClose={() => setSelectedSale(null)} />
            )}
        </div>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed text-gray-400">
            <Eye className="w-12 h-12 opacity-10 mb-4" />
            <p>No se encontraron registros en este período.</p>
        </div>
    );
}

"use client";
import { useState, useEffect } from "react";
import { Search, Calendar, User, Printer, Eye, ChevronLeft, ChevronRight, Hash, Clock, CreditCard, List, FileText, ArrowUpDown, Info, BadgePercent, Filter, Download } from "lucide-react";
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
    const [showFilters, setShowFilters] = useState(false);
    const [pagination, setPagination] = useState({ currentPage: 1, pages: 1, total: 0, totalAmount: 0 });

    const userRole = (session?.user as any)?.role;
    const isAdmin = userRole === "ADMIN";

    const getLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [dateFilter, setDateFilter] = useState(searchParams.get("startDate") ? "custom" : "month");
    const [startDate, setStartDate] = useState(() => {
        const param = searchParams.get("startDate");
        if (param) return param;
        // Default to first day of month
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const y = firstDay.getFullYear();
        const m = String(firstDay.getMonth() + 1).padStart(2, '0');
        const d = String(firstDay.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    });
    // Allow empty end date (open range)
    const [endDate, setEndDate] = useState(searchParams.get("endDate") || "");
    const [search, setSearch] = useState("");
    const [selectedSale, setSelectedSale] = useState<any>(null);

    const [columnFilters, setColumnFilters] = useState({
        ticket: "",
        product: "",
        branch: searchParams.get("branchName") || "",
        seller: ""
    });

    // Reset page when filters change
    useEffect(() => {
        setPagination(prev => ({ ...prev, currentPage: 1 }));
    }, [viewMode, startDate, endDate, search, columnFilters]);

    // Sync view mode with URL
    useEffect(() => {
        if (viewParam === "items" && viewMode !== "items") setViewMode("items");
        if (viewParam === "sales" && viewMode !== "sales") setViewMode("sales");
    }, [viewParam]);

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
            params.append("page", pagination.currentPage.toString());
            params.append("pageSize", "100");
            url = `/api/sales?${params.toString()}`;
            const res = await fetch(url);
            const data = await res.json();
            setSales(data.sales || []);
            setPagination(prev => ({
                ...prev,
                pages: data.pagination?.pages || 1,
                total: data.pagination?.total || 0,
                totalAmount: data.pagination?.totalAmount || 0
            }));
        } else {
            params.append("page", pagination.currentPage.toString());
            params.append("pageSize", "100");
            url = `/api/sales/items?${params.toString()}`;
            const res = await fetch(url);
            const data = await res.json();
            setItems(data.items || []);
            setPagination(prev => ({
                ...prev,
                pages: data.pagination?.pages || 1,
                total: data.pagination?.total || 0,
                totalAmount: data.pagination?.totalAmount || 0
            }));
        }
        setLoading(false);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData();
        }, 500); // Debounce filters
        return () => clearTimeout(timer);
    }, [startDate, endDate, shiftIdParam, viewMode, search, columnFilters, pagination.currentPage]); // Add currentPage

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

    const exportItemsToCSV = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (shiftIdParam) params.append("shiftId", shiftIdParam);
            else {
                params.append("startDate", startDate);
                params.append("endDate", endDate);
            }
            if (search) params.append("search", search);
            if (columnFilters.ticket) params.append("ticketNumber", columnFilters.ticket);
            if (columnFilters.product) params.append("productName", columnFilters.product);
            if (columnFilters.branch) params.append("branchName", columnFilters.branch);
            if (columnFilters.seller) params.append("sellerName", columnFilters.seller);

            // Fetch ALL items for export
            params.append("pageSize", "10000");
            const res = await fetch(`/api/sales/items?${params.toString()}`);
            const data = await res.json();
            const exportItems = data.items || [];

            if (exportItems.length === 0) {
                alert("No hay datos para exportar");
                return;
            }

            const headers = ["Sucursal", "Vendedor", "Fecha", "Comprobante", "Producto", "Cantidad", "Precio Unitario", "Subtotal"];

            const csvData = exportItems.map((item: any) => [
                item.sale?.branch?.name || "-",
                item.sale?.user?.name || "-",
                formatDateTime(item.sale?.createdAt),
                `#${item.sale?.number || "N/A"}`,
                item.product?.name || "Producto Eliminado",
                item.quantity.toString(),
                item.price.toString(),
                (Number(item.price) * Number(item.quantity)).toFixed(2)
            ]);

            const csvContent = [headers, ...csvData]
                .map(row => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
                .join("\n");

            downloadCSV(csvContent, `reporte_ventas_detallado_${new Date().toISOString().split('T')[0]}.csv`);
        } catch (error) {
            console.error(error);
            alert("Error al exportar datos");
        } finally {
            setLoading(false);
        }
    };

    const exportSalesToCSV = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (shiftIdParam) params.append("shiftId", shiftIdParam);
            else {
                params.append("startDate", startDate);
                params.append("endDate", endDate);
            }
            if (search) params.append("search", search);
            if (columnFilters.ticket) params.append("ticketNumber", columnFilters.ticket);
            if (columnFilters.branch) params.append("branchName", columnFilters.branch);
            if (columnFilters.seller) params.append("sellerName", columnFilters.seller);

            // Dashboard IDs
            const urlBranch = searchParams.get("branchId");
            if (urlBranch) params.append("branchId", urlBranch);
            const urlUser = searchParams.get("userId");
            if (urlUser) params.append("userId", urlUser);
            const paymentMethod = searchParams.get("paymentMethod");
            if (paymentMethod) params.append("paymentMethod", paymentMethod);

            // Fetch ALL sales for export
            params.append("pageSize", "10000");
            const res = await fetch(`/api/sales?${params.toString()}`);
            const data = await res.json();
            const exportSales = data.sales || [];

            if (exportSales.length === 0) {
                alert("No hay datos para exportar");
                return;
            }

            // Columnas: nro de comprobante, descuento, metodo de pago, importe
            const headers = ["Comprobante", "Fecha", "Vendedor", "Descuento", "Metodo de Pago", "Importe"];

            const csvData = exportSales.map((sale: any) => [
                `#${sale.number || sale.id.slice(-6).toUpperCase()}`,
                formatDateTime(sale.createdAt),
                sale.user?.name || "N/A",
                sale.discount.toString(),
                sale.paymentMethod,
                sale.total.toString()
            ]);

            const csvContent = [headers, ...csvData]
                .map(row => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
                .join("\n");

            downloadCSV(csvContent, `reporte_comprobantes_detallado_${new Date().toISOString().split('T')[0]}.csv`);
        } catch (error) {
            console.error(error);
            alert("Error al exportar datos");
        } finally {
            setLoading(false);
        }
    };

    const downloadCSV = (content: string, fileName: string) => {
        const blob = new Blob(["\ufeff" + content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

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

            <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-xl border border-gray-100 shadow-sm mb-6">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder={viewMode === "items" ? "Buscar producto, código, ticket..." : "Buscar N° Venta o Cajero..."}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="input input-sm pl-9 bg-gray-50 border-none"
                    />
                </div>
                {!shiftIdParam && (
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`btn btn-sm flex items-center gap-2 ${showFilters ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        <Filter className="w-4 h-4" />
                        <span className="hidden sm:inline">Filtros Avanzados</span>
                    </button>
                )}
                {isAdmin && viewMode === "sales" && sales.length > 0 && (
                    <button
                        onClick={exportSalesToCSV}
                        className="btn btn-sm bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
                        title="Exportar Comprobantes a CSV"
                    >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Exportar CSV</span>
                    </button>
                )}
                {isAdmin && viewMode === "items" && items.length > 0 && (
                    <button
                        onClick={exportItemsToCSV}
                        className="btn btn-sm bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
                        title="Exportar Detalle a CSV"
                    >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Exportar CSV</span>
                    </button>
                )}
            </div>

            {showFilters && !shiftIdParam && (
                <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-xl shadow-blue-50/50 mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Fecha Desde</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => { setStartDate(e.target.value); setDateFilter("custom"); }}
                                className="input input-sm"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block ml-1">Fecha Hasta</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => { setEndDate(e.target.value); setDateFilter("custom"); }}
                                className="input input-sm"
                            />
                        </div>
                        <div className="flex gap-2 pb-0.5">
                            <button onClick={() => { setStartDate(""); setEndDate(""); setSearch(""); setDateFilter("custom"); }} className="text-xs text-red-500 font-bold hover:underline">Limpiar Filtros</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {loading && items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed text-gray-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                        <p>Cargando datos...</p>
                    </div>
                ) : viewMode === "sales" ? (
                    // SALES CARD VIEW
                    sales.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <div className="grid gap-3">
                            {sales.map(sale => (
                                <div key={sale.id} className={`group rounded-2xl p-4 border shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${sale.type === 'REFUND' ? 'bg-red-50 border-red-100 hover:border-red-200' : 'bg-white border-gray-100 hover:border-blue-100'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${sale.type === 'REFUND' ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                            {sale.type === 'REFUND' ? <ArrowUpDown className="w-6 h-6" /> : <Hash className="w-6 h-6" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`font-black text-lg truncate ${sale.type === 'REFUND' ? 'text-red-700' : 'text-gray-800'}`}>
                                                    #{sale.number || sale.id.slice(-6).toUpperCase()}
                                                </span>
                                                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-bold uppercase whitespace-nowrap">{sale.paymentMethod}</span>
                                                {sale.type === 'REFUND' && <span className="text-[10px] bg-red-200 text-red-700 px-2 py-0.5 rounded font-bold uppercase whitespace-nowrap">NOTA CRÉDITO</span>}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                                                <span className="flex items-center gap-1 whitespace-nowrap"><Clock className="w-3 h-3" /> {formatTime(sale.createdAt)}</span>
                                                <span className="flex items-center gap-1 whitespace-nowrap truncate"><User className="w-3 h-3" /> {sale.user?.name}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-8 border-t sm:border-t-0 pt-3 sm:pt-0">
                                        <div className="text-left sm:text-right">
                                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-tighter sm:hidden">Total</p>
                                            {Number(sale.discount) !== 0 || Number(sale.adjustment) !== 0 ? (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            <div className="flex items-center justify-end gap-1 cursor-help group-hover/price:opacity-100">
                                                                <BadgePercent className="w-4 h-4 text-orange-500 animate-pulse" />
                                                                <p className={`text-2xl font-black border-b border-dotted ${sale.type === 'REFUND' ? 'text-red-600 border-red-300' : 'text-blue-600 border-blue-300'}`}>
                                                                    {formatPrice(sale.total, settings.useDecimals)}
                                                                </p>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <div className="text-xs">
                                                                <p>Subtotal: {formatPrice(Number(sale.total) + Number(sale.discount) - Number(sale.adjustment), settings.useDecimals)}</p>
                                                                {Number(sale.discount) > 0 && <p className="text-red-500">Descuento: -{formatPrice(sale.discount, settings.useDecimals)}</p>}
                                                                {Number(sale.adjustment) !== 0 && <p className="text-gray-500">Ajuste: {Number(sale.adjustment) > 0 ? '+' : ''}{formatPrice(sale.adjustment, settings.useDecimals)}</p>}
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            ) : (
                                                <p className={`text-2xl font-black ${sale.type === 'REFUND' ? 'text-red-600' : 'text-blue-600'}`}>
                                                    {formatPrice(sale.total, settings.useDecimals)}
                                                </p>
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
                        {/* Mobile Items View */}
                        <div className="grid grid-cols-1 gap-3 p-3 md:hidden">
                            {items.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">Sin resultados</div>
                            ) : items.map((item) => (
                                <div key={item.id} className={`p-4 rounded-xl border transition-all ${item.sale?.type === 'REFUND' ? 'bg-red-50 border-red-100 ring-1 ring-red-50' : 'bg-white border-gray-100 shadow-sm'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <p className="font-black text-gray-900 leading-tight">{item.product?.name || "Producto Eliminado"}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-bold text-gray-500 font-mono">#{item.sale?.number || "N/A"}</span>
                                                <span className="text-[10px] font-medium text-gray-400 uppercase">{formatDateTime(item.sale?.createdAt)}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={async () => {
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
                                            className="p-2 bg-gray-50 text-gray-400 rounded-lg"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex items-end justify-between border-t pt-3 mt-3">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sucursal / Vendedor</span>
                                            <p className="text-[11px] text-gray-600 font-bold truncate max-w-[150px] uppercase">
                                                {item.sale?.branch?.name || "-"} • {item.sale?.user?.name || "N/A"}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">
                                                {item.quantity} {item.quantity > 1 ? 'unidades' : 'unidad'}
                                            </p>
                                            <p className={`text-lg font-black ${item.sale?.type === 'REFUND' ? 'text-red-600' : 'text-blue-600'}`}>
                                                {item.sale?.type === 'REFUND' && "-"}
                                                {formatPrice(roundCurrency(item.price * item.quantity), settings.useDecimals)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
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
                                        <tr key={item.id} className={`transition-colors ${item.sale?.type === 'REFUND' ? 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500' : 'hover:bg-blue-50/30'}`}>
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
                                            <td className={`px-6 py-3 text-right font-black ${item.sale?.type === 'REFUND' ? 'text-red-600' : 'text-blue-600'}`}>
                                                {(() => {
                                                    let displayAmount = item.price * item.quantity;

                                                    return (
                                                        <>
                                                            {item.sale?.type === 'REFUND' && "-"}
                                                            {formatPrice(roundCurrency(displayAmount), settings.useDecimals)}
                                                        </>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-6 py-3 text-gray-500 text-xs uppercase">
                                                {item.sale?.user?.name || "N/A"}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <button
                                                    onClick={async () => {
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
                    </div>
                )}
                {/* Pagination Footer - Always visible if viewed */}
                {viewMode && (
                    <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs text-gray-500 font-medium mt-auto">
                        <div className="flex items-center gap-4">
                            <div>
                                Mostrando <span className="text-gray-900 font-bold">
                                    {viewMode === "sales" ? sales.length : items.length}
                                </span> de <span className="text-gray-900 font-bold">
                                    {pagination.total}
                                </span> {viewMode === "sales" ? "comprobantes" : "ítems"}
                            </div>
                            <div className="h-4 w-px bg-gray-300" />
                            <div className="bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                                <span className="text-blue-600 uppercase tracking-tighter mr-1">Total:</span>
                                <span className="text-blue-900 font-black text-sm">
                                    {formatPrice(pagination.totalAmount)}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPagination(p => ({ ...p, currentPage: Math.max(1, p.currentPage - 1) }))}
                                disabled={pagination.currentPage === 1}
                                className="p-1 px-3 rounded bg-white border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Anterior
                            </button>
                            <span className="px-2">
                                Página <span className="text-gray-900 font-bold">{pagination.currentPage}</span> de <span className="text-gray-900 font-bold">{pagination.pages}</span>
                            </span>
                            <button
                                onClick={() => setPagination(p => ({ ...p, currentPage: Math.min(p.pages, p.currentPage + 1) }))}
                                disabled={pagination.currentPage === pagination.pages}
                                className="p-1 px-3 rounded bg-white border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
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

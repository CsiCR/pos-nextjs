"use client";
import { useRef, useState, useEffect, Suspense } from "react";
import { Search, Plus, Upload, Filter, Download, MoreVertical, Edit2, Trash2, X, Archive, RefreshCw, FileDown, Package, Scale, Tag, AlertCircle, AlertTriangle, CheckCircle2, Printer, MapPin, ChevronLeft, ChevronRight, ArrowRightLeft } from "lucide-react";
import { formatPrice, formatStock } from "@/lib/utils";
import { useSettings } from "@/hooks/use-settings";
import { Switch } from "@/components/ui/switch";
import { TransferModal } from "@/components/TransferModal";

import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { PrintLabelsModal } from "@/components/PrintLabelsModal";

function ImportModal({
  onClose,
  onUpload,
  preview,
  onConfirm,
  loading
}: {
  onClose: () => void,
  onUpload: (e: any) => void,
  preview: any[],
  onConfirm: () => void,
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-3xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Upload className="w-6 h-6 text-green-600" />
            </div>
            Importar Productos desde CSV
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">&times;</button>
        </div>

        {!preview.length ? (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-blue-800">
              <h3 className="font-bold flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5" /> Instrucciones del archivo
              </h3>
              <p className="text-sm opacity-90 mb-2">El archivo debe ser un **CSV** separado por comas o punto y coma.</p>
              <p className="text-xs font-bold text-blue-700 mb-4 bg-white/50 p-2 rounded-lg border border-blue-200">
                💡 Recomendación Excel: Guarda tu archivo como **"CSV UTF-8 (delimitado por comas)"**.
              </p>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div className="bg-white/50 p-3 rounded-lg border border-blue-200">
                  <p className="font-bold text-blue-900">Obligatorios:</p>
                  <ul className="list-disc list-inside">
                    <li>Nombre</li>
                    <li>Precio</li>
                  </ul>
                </div>
                <div className="bg-white/50 p-3 rounded-lg border border-blue-200">
                  <p className="font-bold text-blue-900">Opcionales:</p>
                  <ul className="list-disc list-inside">
                    <li>Codigo, EAN, Stock</li>
                    <li>Stock Minimo (o Minimo)</li>
                    <li>Categoria, Unidad</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center hover:border-blue-400 hover:bg-blue-50/10 transition-all group">
              <label className="cursor-pointer">
                <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4 group-hover:text-blue-500 transition-colors" />
                <p className="text-gray-500 font-medium">Click para seleccionar o arrastra tu archivo CSV</p>
                <input type="file" accept=".csv" onChange={onUpload} className="hidden" />
              </label>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-bold">Vista Previa ({preview.length} filas detectadas)</span>
              </div>
              <button onClick={() => window.location.reload()} className="text-xs text-green-700 underline font-bold uppercase tracking-wider">Cambiar archivo</button>
            </div>

            <div className="flex-1 overflow-auto border border-gray-100 rounded-2xl custom-scrollbar">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr className="text-left font-bold text-gray-600 uppercase tracking-wider">
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3 text-right">Precio</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3">Categoría</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {preview.slice(0, 100).map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.nombre}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono italic">{p.codigo || p.ean || "-"}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">${p.precio}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{p.stock}</td>
                      <td className="px-4 py-3"><span className="bg-gray-100 px-2 py-0.5 rounded text-[10px]">{p.categoria || "-"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 100 && (
                <div className="p-4 text-center text-gray-500 italic bg-gray-50 border-t">
                  ... y {preview.length - 100} productos más.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-6 mt-4 border-t">
          <button onClick={onClose} className="btn bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold">Cancelar</button>
          <button onClick={onConfirm} disabled={loading} className="btn btn-primary shadow-xl shadow-blue-100 font-bold">
            {loading ? "Procesando..." : "Confirmar e Importar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Final Export wrapper with Suspense for searchParams safety
export default function ProductosPage() {
  return (
    <div className="flex-1">
      <div className="mx-auto">
        <div className="relative">
          <div className="animate-in fade-in duration-500">
            <div className="bg-white/50 backdrop-blur-sm sticky top-0 z-30 mb-6 pb-4">
              {/* We could put a skeleton here if preferred */}
            </div>
            <Suspense fallback={<div className="p-12 text-center text-gray-500 font-bold animate-pulse uppercase tracking-widest">Cargando catálogo...</div>}>
              <ProductosContent />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductosContent() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const userBranchId = (session?.user as any)?.branchId;
  const isSupervisor = role === "SUPERVISOR";
  const canDelete = role === "ADMIN" || role === "GERENTE";

  const { settings } = useSettings();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get("filterMode") || "all";
  const initialBranch = searchParams.get("branchId") || "";

  const [filterMode, setFilterMode] = useState(initialFilter);
  const [selectedBranch, setSelectedBranch] = useState(initialBranch);
  const [onlyMyBranch, setOnlyMyBranch] = useState(isSupervisor && !initialBranch);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<any>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [priceLists, setPriceLists] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    name: "",
    basePrice: "",
    minStock: "",
    stock: "",
    categoryId: "",
    baseUnitId: "",
    ean: "",
    active: true,
    prices: {},
    branchMinStocks: {},
    branchQuantities: {}
  });
  const [loading, setLoading] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [transferModal, setTransferModal] = useState<any[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // [NEW] Selection State
  const [showFilters, setShowFilters] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 100;

  const fetchData = async () => {
    const [resp, cats, unis, lists, brs] = await Promise.all([
      fetch(`/api/products?search=${search}&filterMode=${filterMode}&categoryId=${selectedCategory}&branchId=${selectedBranch}&page=${currentPage}&pageSize=${pageSize}&onlyMyBranch=${onlyMyBranch}${filterMode === 'inactive' ? '&showInactive=true' : ''}`).then(r => r.json()),
      fetch("/api/categories").then(r => r.json()),
      fetch("/api/measurement-units").then(r => r.json()),
      fetch("/api/price-lists").then(r => r.json()),
      fetch("/api/branches").then(r => r.json())
    ]);


    if (resp && Array.isArray(resp.products)) {
      setProducts(resp.products);
      setTotalPages(resp.totalPages || 1);
      setTotalItems(resp.total || 0);
      // [DEBUG] Check if Alfajores are in the data
      if (resp.products.length > 0) {
        const alfajores = resp.products.filter((p: any) => p.name.toUpperCase().includes("ALFAJOR"));
        console.log(`[DEBUG] FetchData returned ${resp.products.length} products (Total: ${resp.total}). Alfajores found: ${alfajores.length}`);
      }
    } else {
      console.error("Error fetching products:", resp);
      setProducts([]);
    }

    setCategories(cats || []);
    setUnits(unis || []);
    setPriceLists(lists || []);
    setBranches(brs || []);
  };

  // Handle filter changes separately from page changes
  useEffect(() => {
    setCurrentPage(1);
    fetchData().catch(err => console.error("Filter Change Fetch Error:", err));
    setSelectedIds([]);
  }, [search, filterMode, selectedCategory, selectedBranch, onlyMyBranch]);

  useEffect(() => {
    fetchData().catch(err => console.error("Page Change Fetch Error:", err));
  }, [currentPage]);

  // [NEW] Modal Focus Effect
  useEffect(() => {
    if (modal) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [modal]);

  const openNew = () => {
    setForm({
      name: "",
      basePrice: "",
      minStock: "",
      stock: "",
      categoryId: "",
      baseUnitId: units.find(u => u.isBase)?.id || "",
      ean: "",
      prices: {},
      branchMinStocks: {},
      branchQuantities: {}
    });
    setModal({ type: "new" });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) return;

      // Detectar delimitador (punto y coma es común en Excel español)
      const firstLine = lines[0];
      const delimiter = firstLine.includes(";") && (firstLine.split(";").length > firstLine.split(",").length) ? ";" : ",";

      const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase());

      const parsed = lines.slice(1).map(line => {
        const values = line.split(delimiter).map(v => {
          let val = v.trim();
          // Eliminar comillas envolventes si existen (común en exportaciones de Excel)
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1).trim();
          }
          return val;
        });
        const obj: any = {};
        headers.forEach((h, i) => {
          const header = h.replace(/^"|"$/g, '').trim().toLowerCase();
          if (header.includes("nombre")) obj.nombre = values[i];
          if (header.includes("cod") || header.includes("sku")) obj.codigo = values[i];
          if (header.includes("ean") || header.includes("barra")) obj.ean = values[i];
          if (header.includes("precio")) obj.precio = values[i];
          if (header.includes("stock") && !header.includes("min")) obj.stock = values[i];
          if (header.includes("min")) obj.minStock = values[i];
          if (header.includes("cat")) obj.categoria = values[i];
          if (header.includes("uni")) obj.unidad = values[i];
        });
        return obj;
      });
      console.log("Parsed CSV:", parsed);
      setPreviewData(parsed);
    };
    // Priorizamos UTF-8 para mayor compatibilidad moderna
    reader.readAsText(file, "UTF-8");
  };

  const [importResults, setImportResults] = useState<any>(null); // { count: number, warnings: [] }

  const executeImport = async () => {
    setImporting(true);
    try {
      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(previewData)
      });
      const data = await res.json();
      if (res.ok) {
        setImportModal(false);
        setPreviewData([]);

        // Handle Results Display
        if (data.warnings && data.warnings.length > 0) {
          setImportResults({ count: data.count, warnings: data.warnings });
        } else {
          alert(`¡Éxito! Se importaron ${data.count} productos correctamente sin obseraciones.`);
        }

        fetchData();
      } else {
        alert(data.error || "Error al importar");
      }
    } catch (error) {
      alert("Error de conexión");
    } finally {
      setImporting(false);
    }
  };

  const openEdit = (p: any) => {
    const priceMap: Record<string, any> = {};
    p.prices?.forEach((pp: any) => {
      priceMap[pp.priceListId] = pp.price;
    });

    const minStockMap: Record<string, any> = {};
    const quantityMap: Record<string, any> = {};
    p.stocks?.forEach((s: any) => {
      minStockMap[s.branchId] = Number(s.minStock);
      quantityMap[s.branchId] = Number(s.quantity);
    });

    setForm({
      name: p.name,
      basePrice: p.basePrice || 0,
      minStock: p.displayMinStock ?? (p.stocks?.find((s: any) => s.branchId === userBranchId)?.minStock || p.minStock || 0),
      stock: p.displayStock ?? (p.stocks?.find((s: any) => s.branchId === userBranchId)?.quantity || 0),
      categoryId: p.categoryId || "",
      baseUnitId: p.baseUnitId || "",
      ean: p.ean || "",
      active: p.active ?? true,
      prices: priceMap,
      branchMinStocks: minStockMap,
      branchQuantities: quantityMap
    });
    setModal({ type: "edit", id: p.id });
  };

  const save = async () => {
    setLoading(true);
    try {
      // Validation basics
      if (!form.name.trim()) throw new Error("Debes ingresar un nombre para el producto.");
      if (form.basePrice === "" || isNaN(Number(form.basePrice))) throw new Error("Debes ingresar un precio base válido.");

      // Map branch stocks back to array for API
      const branchStocks = priceLists.filter(l => l.branchId).map(l => ({
        branchId: l.branchId,
        minStock: Number(form.branchMinStocks[l.branchId || ""]) || 0,
        quantity: Number(form.branchQuantities[l.branchId || ""]) || 0
      }));

      // Map prices object back to array for API
      const pricesArray = Object.entries(form.prices).map(([listId, price]) => ({
        priceListId: listId,
        price: Number(price)
      }));

      const body = {
        ...form,
        basePrice: Number(form.basePrice),
        minStock: Number(form.minStock) || 0,
        stock: Number(form.stock) || 0,
        active: Boolean(form.active),
        prices: pricesArray,
        branchStocks
      };

      let res;
      if (modal.type === "new") {
        res = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        res = await fetch(`/api/products/${modal.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }

      const data = await res.json();

      if (res.ok) {
        setModal(null);
        fetchData();
      } else {
        // Detailed Error Handling
        let errorMsg = data.error || "Error al guardar el producto";

        if (errorMsg.includes("Unique constraint")) {
          if (errorMsg.includes("code")) errorMsg = "Ya existe un producto con este código interno.";
          if (errorMsg.includes("ean")) errorMsg = "Ya existe un producto con este código de barras (EAN).";
        }
        if (errorMsg.includes("Unauthorized")) errorMsg = "No tienes permisos para realizar esta acción.";

        alert(`⚠️ Atención: ${errorMsg}${data.detail ? `\n\nDetalle técnico: ${JSON.stringify(data.detail)}` : ""}`);
      }
    } catch (error: any) {
      console.error("Error saving product:", error);
      alert(error.message || "Error al guardar el producto");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    const product = products.find(p => p.id === id);
    if (!product) return;

    const isGlobal = !product.branchId;
    const isSupervisor = role === "SUPERVISOR";

    // Specific Differentiated Messages
    let confirmMsg = "¿Confirma que desea desactivar este producto?";
    if (isSupervisor && isGlobal) {
      confirmMsg = `El producto "${product.name}" es Global. \n\n¿Deseas OCULTARLO de tu sucursal? \n(Esto no afectará a las demás sucursales y podrás reactivarlo si ingresas mercadería).`;
    }

    if (!confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (res.ok) {
        fetchData();
      } else {
        // Muestra el error específico del backend (ej: bloqueo por stock)
        alert(`No se pudo realizar la acción: ${data.error || "Error desconocido"}${data.details ? `\n\n${data.details}` : ""}`);
      }
    } catch (error) {
      console.error("Error deleting product:", error);
      alert("Error de conexión al intentar eliminar el producto.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams({
      search,
      filterMode,
      categoryId: selectedCategory,
      branchId: selectedBranch,
      onlyMyBranch: String(onlyMyBranch)
    });
    window.location.href = `/api/products/export?${params.toString()}`;
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === products.length) setSelectedIds([]);
    else setSelectedIds(products.map(p => p.id));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Catálogo de Productos</h1>
          <p className="text-gray-500">Administra precios, unidades y stock de la sucursal</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button onClick={handleExport} className="btn bg-white border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-2 h-11 px-3 sm:px-4" title="Exportar CSV">
            <Download className="w-5 h-5" /> <span className="hidden sm:inline">Exportar</span>
          </button>
          <button onClick={() => setShowFilters(!showFilters)} className={`btn flex items-center gap-2 h-11 px-3 sm:px-4 ${showFilters ? 'bg-blue-600 text-white' : 'bg-white border-gray-200 text-gray-600'}`}>
            <Filter className="w-5 h-5" /> <span className="hidden sm:inline">{showFilters ? "Ocultar Filtros" : "Filtros"}</span>
          </button>
          <button onClick={openNew} className="btn btn-primary shadow-lg shadow-blue-100 flex items-center gap-2 h-11 px-3 sm:px-4">
            <Plus className="w-5 h-5" /> <span className="hidden xs:inline">Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* Branch Specific Filter Toggle */}
      {userBranchId && (
        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-black text-blue-900 leading-tight">Vista de Sucursal: {branches.find(b => b.id === userBranchId)?.name || 'Tu Sucursal'}</p>
              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">{onlyMyBranch ? 'Mostrando solo productos con stock o vinculados a esta sucursal' : 'Mostrando catálogo global completo'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-blue-100 shadow-sm">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filtrar por mi sucursal</span>
            <Switch
              checked={onlyMyBranch}
              onCheckedChange={setOnlyMyBranch}
              className="data-[state=checked]:bg-blue-600"
            />
          </div>
        </div>
      )}

      <div className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-300 ${showFilters ? 'max-h-[500px] opacity-100 p-4 mb-4' : 'max-h-0 opacity-0 p-0 border-none mb-0'}`}>
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative group w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, código o EAN..."
              className="input pl-12 w-full bg-gray-50 focus:pl-12"
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="input appearance-none font-medium bg-gray-50 border-gray-200"
            >
              <option value="">Todas las Categorías</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {(role === "ADMIN" || role === "GERENTE") && (
              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="input appearance-none font-medium bg-blue-50 border-blue-100 text-blue-800"
              >
                <option value="">🌎 Stock Global (Total)</option>
                {branches.map(b => <option key={b.id} value={b.id}>📍 {b.name}</option>)}
              </select>
            )}
          </div>

          <select
            value={filterMode}
            onChange={e => setFilterMode(e.target.value)}
            className="input appearance-none font-bold bg-white border-blue-200 text-blue-700 hover:border-blue-400 transition-all cursor-pointer"
          >
            <option value="all">🔍 Todos los Productos</option>
            <option value="low_stock">📉 Stock Bajo (Menor al Mínimo)</option>
            <option value="missing">❌ Faltante / Crítico (Sin Stock)</option>
            <option value="transfer">🔄 Traspaso Sugerido (Hacia Sucursales)</option>
            <option value="inactive">🚫 Productos Desactivados (Papelera)</option>
          </select>
        </div>
      </div>

      <div className="card p-0 border border-gray-100 shadow-sm overflow-hidden">
        {/* Mobile View: Cards */}
        <div className="grid grid-cols-1 gap-4 p-4 md:hidden">
          {(products ?? []).map(p => {
            const stock = p.displayStock ?? (p.stocks?.[0]?.quantity || 0);
            const unit = p.baseUnit?.symbol || "-";
            const isSelected = selectedIds.includes(p.id);
            return (
              <div
                key={p.id}
                className={`p-4 rounded-2xl border transition-all ${isSelected ? 'bg-blue-50 border-blue-200 shadow-md ring-1 ring-blue-100' : 'bg-white border-gray-100 shadow-sm'}`}
                onClick={() => toggleSelect(p.id)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-gray-900 text-lg leading-tight">{p.name}</span>
                      {!p.active && <span className="text-[9px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Inactivo</span>}
                    </div>
                    <p className="text-[10px] font-bold text-gray-400 font-mono mt-1 uppercase tracking-tighter">COD: {p.code}</p>
                  </div>
                  <div className={`shrink-0 inline-flex items-center px-3 py-1 rounded-full font-bold text-xs ${Number(stock) <= 0 ? "bg-red-100 text-red-600" :
                    Number(stock) < Number(p.displayMinStock || 0) ? "bg-orange-100 text-orange-600" :
                      "bg-green-100 text-green-600"
                    }`}>
                    {formatStock(stock, p.baseUnit)} {unit}
                  </div>
                </div>

                <div className="flex items-end justify-between gap-4 mt-2">
                  <div className="space-y-2">
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg font-medium text-[10px] uppercase">
                      {p.category?.name || "General"}
                    </span>
                    <div className={`font-black text-xl ${Number(p.displayPrice) < 0 ? 'text-red-600 animate-pulse' : 'text-gray-900'}`}>
                      {formatPrice(p.displayPrice, settings.useDecimals)}
                    </div>
                  </div>

                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEdit(p)} className="p-2.5 bg-gray-50 text-blue-600 rounded-xl border border-gray-100">
                      <Edit2 className="w-5 h-5" />
                    </button>
                    {(canDelete || isSupervisor) && (
                      <button onClick={() => remove(p.id)} className="p-2.5 bg-gray-50 text-red-500 rounded-xl border border-gray-100">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-left font-bold text-gray-600 uppercase tracking-wider w-10">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm checkbox-primary"
                    checked={products.length > 0 && selectedIds.length === products.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-4 text-left font-bold text-gray-600 uppercase tracking-wider">Producto</th>
                <th className="px-6 py-4 text-left font-bold text-gray-600 uppercase tracking-wider">Categoría</th>
                <th className="px-6 py-4 text-right font-bold text-gray-600 uppercase tracking-wider">Precio</th>
                <th className="px-6 py-4 text-center font-bold text-gray-600 uppercase tracking-wider">Unidad</th>
                <th className="px-6 py-4 text-right font-bold text-gray-600 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-4 text-center font-bold text-gray-600 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {(products ?? []).map(p => {
                const stock = p.displayStock ?? (p.stocks?.[0]?.quantity || 0);
                const unit = p.baseUnit?.symbol || "-";
                return (
                  <tr key={p.id} className={`hover:bg-blue-50/30 transition-colors group ${selectedIds.includes(p.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm checkbox-primary"
                        checked={selectedIds.includes(p.id)}
                        onChange={() => toggleSelect(p.id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-gray-900 text-base tracking-tight">{p.name}</span>
                          {!p.active && <span className="text-[9px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full uppercase tracking-tighter shadow-sm border border-red-200 animate-pulse">Inactivo</span>}
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 font-mono tracking-tighter uppercase">{p.code}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg font-medium text-xs">
                        {p.category?.name || "General"}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-right font-black text-base ${Number(p.displayPrice) < 0 ? 'text-red-600 animate-pulse' : 'text-gray-900'}`}>
                      <div className="flex items-center justify-end gap-2">
                        {p.priceAlert && (
                          <span className="text-orange-500 hover:text-orange-600 transition-colors cursor-help" title={`Precio por debajo del base ($${formatPrice(p.basePrice, settings.useDecimals)})`}>
                            <AlertTriangle className="w-4 h-4" />
                          </span>
                        )}
                        {formatPrice(p.displayPrice, settings.useDecimals)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-gray-500 font-medium">{unit}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs ${Number(stock) <= 0 ? "bg-red-100 text-red-600" :
                        Number(stock) < Number(p.displayMinStock || 0) ? "bg-orange-100 text-orange-600" :
                          "bg-green-100 text-green-600"
                        }`}>
                        {formatStock(stock, p.baseUnit)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-1 transition-opacity">
                        <button onClick={() => openEdit(p)} className="p-2 hover:bg-white hover:shadow-md border border-transparent hover:border-gray-100 rounded-xl transition text-blue-600" title="Editar">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {settings.isClearingEnabled && (
                          <button onClick={() => setTransferModal([p])} className="p-2 hover:bg-white hover:shadow-md border border-transparent hover:border-gray-100 rounded-xl transition text-orange-600" title="Traspasar">
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>
                        )}
                        {(canDelete || isSupervisor) && (
                          <button onClick={() => remove(p.id)} className="p-2 hover:bg-white hover:shadow-md border border-transparent hover:border-gray-100 rounded-xl transition text-red-500" title="Eliminar">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>


        {/* Pagination Controls */}
        {products.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50/50 border-t border-gray-100 italic">
            <div className="flex items-center gap-2 text-xs text-gray-500 font-bold">
              Mostrando {products.length} de {totalItems} productos
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition disabled:opacity-30 text-gray-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 px-3 py-1 bg-white rounded-lg shadow-sm border border-gray-100">
                <span className="text-xs font-black text-blue-600">{currentPage}</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">de {totalPages}</span>
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition disabled:opacity-30 text-gray-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* [NEW] Selection Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-4 rounded-2xl shadow-2xl flex items-center gap-3 sm:gap-6 z-40 animate-in slide-in-from-bottom-10 w-[95%] sm:w-auto overflow-hidden justify-between sm:justify-start">
          <div className="flex flex-col shrink-0">
            <span className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase tracking-wider">{selectedIds.length} <span className="hidden xs:inline">seleccionados</span></span>
          </div>
          <div className="h-8 w-px bg-gray-700 hidden xs:block" />
          <button
            onClick={() => setModal({ type: "print_labels", ids: selectedIds })}
            className="btn btn-primary btn-sm flex items-center gap-2 text-xs py-2 px-3 sm:px-4"
          >
            <Printer className="w-4 h-4" /> <span className="hidden sm:inline">Imprimir Etiquetas</span><span className="sm:hidden">Etiquetas</span>
          </button>

          {settings.isClearingEnabled && (
            <button
              onClick={() => {
                const selectedProducts = products.filter(p => selectedIds.includes(p.id));
                setTransferModal(selectedProducts);
              }}
              className="btn bg-orange-600 hover:bg-orange-700 text-white btn-sm flex items-center gap-2 text-xs py-2 px-3 sm:px-4 border-none"
            >
              <ArrowRightLeft className="w-4 h-4" /> <span className="hidden sm:inline">Solicitar Traspaso</span><span className="sm:hidden">Traspaso</span>
            </button>
          )}
          <button
            onClick={() => setSelectedIds([])}
            className="text-gray-400 hover:text-white transition-colors p-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {(modal?.type === "new" || modal?.type === "edit") && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-gray-900 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                {modal.type === "new" ? "Nuevo Producto" : "Editar Producto"}
              </h2>
              <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100">
                <div className={`w-2 h-2 rounded-full ${form.active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`} />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">{form.active ? 'Activo' : 'Inactivo'}</span>
                <button
                  onClick={() => setForm({ ...form, active: !form.active })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${form.active ? 'bg-green-600' : 'bg-gray-300'}`}
                >
                  <span className={`${form.active ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm`} />
                </button>
              </div>
            </div>

            <div className="space-y-6 flex-1 overflow-auto pr-2 custom-scrollbar">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Nombre del Producto</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="input input-lg font-bold bg-gray-50/30"
                  placeholder="Ej: Coca Cola 2.25L"
                  onFocus={e => e.target.select()}
                />
              </div>

              {/* [NEW] MI SUCURSAL Section - HIGH PRIORITY GRID */}
              {userBranchId && (
                <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-3xl shadow-sm">
                  <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Datos en sucursal: {branches.find(b => b.id === userBranchId)?.name || 'Local'}
                  </label>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter mb-1 block">Precio Local</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-blue-400 text-xs">$</span>
                        <input
                          type="number"
                          value={form.prices[priceLists.find(l => l.branchId === userBranchId)?.id || ""] || ""}
                          onChange={e => {
                            const listId = priceLists.find(l => l.branchId === userBranchId)?.id;
                            if (listId) {
                              const val = e.target.value;
                              const newPrices = { ...form.prices, [listId]: val };
                              const newForm = { ...form, prices: newPrices };
                              if (modal.type === "new" && (!form.basePrice || form.basePrice === "")) {
                                newForm.basePrice = val;
                              }
                              setForm(newForm);
                            }
                          }}
                          className="input font-black text-right pl-6 text-blue-700 bg-white border-blue-200 focus:ring-blue-100"
                          placeholder="0"
                          onFocus={e => e.target.select()}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-orange-400 uppercase tracking-tighter mb-1 block">Sugerido Global</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-xs">$</span>
                        <input
                          type="number"
                          value={form.basePrice}
                          onChange={e => setForm({ ...form, basePrice: e.target.value })}
                          className={`input font-black text-right pl-6 bg-gray-50/50 border-orange-100 text-gray-500 ${!canDelete ? 'cursor-not-allowed' : 'hover:border-orange-300'}`}
                          onFocus={e => e.target.select()}
                          disabled={!canDelete && modal.type !== "new"}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter mb-1 block">Stock Actual</label>
                      <input
                        type="number"
                        value={form.branchQuantities[userBranchId] === 0 ? "0" : (form.branchQuantities[userBranchId] || "")}
                        onChange={e => setForm({
                          ...form,
                          branchQuantities: { ...form.branchQuantities, [userBranchId]: e.target.value }
                        })}
                        className="input font-bold text-right bg-white border-gray-200"
                        placeholder="0"
                        onFocus={e => e.target.select()}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter mb-1 block">Stock Mín.</label>
                      <input
                        type="number"
                        value={form.branchMinStocks[userBranchId] === 0 ? "0" : (form.branchMinStocks[userBranchId] || "")}
                        onChange={e => setForm({
                          ...form,
                          branchMinStocks: { ...form.branchMinStocks, [userBranchId]: e.target.value }
                        })}
                        className="input font-bold text-right bg-white border-orange-200 text-orange-600"
                        placeholder="0"
                        onFocus={e => e.target.select()}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* [REORGANIZED] Metadata Grid: Category, Unit, EAN */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Categoría</label>
                  <select
                    value={form.categoryId}
                    onChange={e => {
                      const newCatId = e.target.value;
                      const category = categories?.find(c => c.id === newCatId);
                      const newForm = { ...form, categoryId: newCatId };
                      if (category && userBranchId && (Number(form.branchMinStocks[userBranchId]) === 0 || !form.branchMinStocks[userBranchId])) {
                        newForm.branchMinStocks = { ...form.branchMinStocks, [userBranchId]: category.defaultMinStock || 0 };
                      }
                      setForm(newForm);
                    }}
                    className="input appearance-none font-medium h-11 text-xs"
                  >
                    <option value="">Sin categoría</option>
                    {(categories ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Unidad</label>
                  <select value={form.baseUnitId} onChange={e => setForm({ ...form, baseUnitId: e.target.value })} className="input appearance-none font-medium h-11 text-xs">
                    <option value="">Unidad...</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Código EAN</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={form.ean}
                      onChange={e => setForm({ ...form, ean: e.target.value })}
                      className="input font-mono h-11 text-[10px] flex-1 px-2"
                      placeholder="EAN..."
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const code = `INT${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`;
                        setForm({ ...form, ean: code });
                      }}
                      className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl transition"
                      title="Generar"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* [NEW] GLOBAL DATA SECTION - Conditional */}
              <div className="pt-4 border-t mt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    const nextEl = (e.currentTarget.nextElementSibling as HTMLElement);
                    if (nextEl) nextEl.classList.toggle('hidden');
                  }}
                  className="flex items-center justify-between w-full text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors"
                >
                  Información Global y Admin
                  <ChevronRight className="w-3 h-3" />
                </button>
                <div className="hidden mt-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-2 gap-4">
                    {canDelete && (
                      <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-tighter mb-1 block">Stock Total (Suma Sucursales)</label>
                        <div className="input input-sm font-black text-right bg-gray-100/50 border-gray-200 text-gray-500 flex items-center justify-end px-3">
                          {Number(Object.values(form.branchQuantities || {}).reduce((acc: number, val: any) => acc + Number(val || 0), 0))}
                        </div>
                        <p className="text-[8px] text-gray-400 mt-1 italic uppercase tracking-tighter">Calculado automáticamente</p>
                      </div>
                    )}
                  </div>
                  {form.ean && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Código Actual</p>
                        <p className="text-xs font-mono font-bold text-gray-900">{form.ean}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const printWindow = window.open('', '_blank');
                          if (printWindow) {
                            printWindow.document.write(`
                                <html>
                                  <head>
                                    <title>Imprimir Etiqueta</title>
                                    <style>
                                      body { font-family: sans-serif; display: flex; flex-direction: column; items: center; justify-content: center; height: 100vh; margin: 0; }
                                      .label { border: 1px solid #eee; padding: 20px; text-align: center; width: 200px; }
                                      .name { font-weight: bold; font-size: 14px; margin-bottom: 5px; }
                                      .price { font-size: 18px; font-weight: 900; margin-bottom: 10px; }
                                      .code { font-family: 'Libre Barcode 128', cursive; font-size: 40px; margin: 10px 0; }
                                      .code-text { font-family: monospace; font-size: 10px; letter-spacing: 2px; }
                                      @media print { body { height: auto; } .label { border: none; } }
                                    </style>
                                    <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
                                  </head>
                                  <body>
                                    <div class="label">
                                      <div class="name">${form.name || 'Producto'}</div>
                                      <div class="price">$${form.basePrice || '0'}</div>
                                      <div class="code">${form.ean}</div>
                                      <div class="code-text">${form.ean}</div>
                                    </div>
                                    <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
                                  </body>
                                </html>
                              `);
                            printWindow.document.close();
                          }
                        }}
                        className="btn btn-sm bg-white border-gray-200 text-gray-600 flex items-center gap-2"
                      >
                        <Printer className="w-4 h-4" /> Imprimir
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {priceLists.length > 0 && (
                <div className="pt-6 border-t mt-4">
                  <label className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4 block">Precios por Lista</label>
                  <div className="space-y-4">
                    {priceLists.filter(list => list.branchId !== userBranchId).map(list => (
                      <div key={list.id} className="flex items-center gap-4 p-3 rounded-2xl border bg-gray-50/50 border-gray-100 hover:border-blue-200 transition-all">
                        <div className="flex-1">
                          <label className="text-[10px] font-black text-gray-600 uppercase tracking-wider block">
                            {list.name}
                          </label>
                          {list.percentage !== 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const calc = form.basePrice * (1 + (list.percentage / 100));
                                setForm({
                                  ...form,
                                  prices: { ...form.prices, [list.id]: Math.round(calc) }
                                });
                              }}
                              className="text-[9px] font-bold text-blue-500 hover:text-blue-700 underline"
                            >
                              Sugerido: {list.percentage > 0 ? "+" : ""}{list.percentage}% (${Math.round(form.basePrice * (1 + (list.percentage / 100)))})
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-20">
                            <input
                              type="number"
                              value={form.branchQuantities[list.branchId || ""] === 0 ? "0" : (form.branchQuantities[list.branchId || ""] || "")}
                              onChange={e => setForm({
                                ...form,
                                branchQuantities: { ...form.branchQuantities, [list.branchId || ""]: e.target.value }
                              })}
                              className="input input-sm font-bold text-right bg-white text-[10px]"
                              placeholder="Stock"
                              onFocus={e => e.target.select()}
                            />
                          </div>
                          <div className="w-24">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[10px]">$</span>
                              <input
                                type="number"
                                value={form.prices[list.id] || ""}
                                onChange={e => setForm({
                                  ...form,
                                  prices: { ...form.prices, [list.id]: e.target.value }
                                })}
                                className="input input-sm pl-4 font-black text-right bg-white text-[10px]"
                                placeholder="Precio"
                                onFocus={e => e.target.select()}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {priceLists.filter(list => list.branchId !== userBranchId).length === 0 && (
                      <p className="text-[10px] text-gray-400 italic text-center py-2">No hay otras sucursales configuradas.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-8 mt-4 border-t">
              <button
                onClick={() => setModal(null)}
                className="btn bg-gray-100 hover:bg-gray-200 text-gray-600 btn-lg font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={loading}
                className="btn btn-primary btn-lg shadow-xl shadow-blue-100 font-bold"
              >
                {loading ? "Guardando..." : "Guardar Producto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal?.type === "print_labels" && (
        <PrintLabelsModal
          ids={modal.ids}
          products={products}
          onClose={() => setModal(null)}
          settings={settings}
        />
      )}

      {importModal && (
        <ImportModal
          onClose={() => { setImportModal(false); setPreviewData([]); }}
          onUpload={handleFileUpload}
          preview={previewData}
          onConfirm={executeImport}
          loading={importing}
        />
      )}

      {importResults && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                </div>
                Resultado de Importación
              </h2>
              <button onClick={() => setImportResults(null)} className="p-2 hover:bg-gray-100 rounded-full transition">&times;</button>
            </div>

            <div className="mb-6">
              <p className="font-bold text-lg text-green-700">✅ {importResults.count} productos procesados correctamente.</p>
              <p className="text-gray-600 mt-1">Sin embargo, hubo {importResults.warnings.length} observaciones que requieren tu atención:</p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl overflow-hidden max-h-[50vh] flex flex-col">
              <div className="overflow-auto custom-scrollbar p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-yellow-800 border-b border-yellow-200">
                      <th className="pb-2 pl-2">Fila</th>
                      <th className="pb-2">Producto</th>
                      <th className="pb-2">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-yellow-200/50">
                    {importResults.warnings.map((w: any, idx: number) => (
                      <tr key={idx} className="hover:bg-yellow-100/50">
                        <td className="py-2 pl-2 font-mono text-yellow-700 font-bold">#{w.row}</td>
                        <td className="py-2 font-medium">{w.name}</td>
                        <td className="py-2 text-yellow-900">{w.issue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={() => setImportResults(null)} className="btn btn-primary">Entendido</button>
            </div>
          </div>
        </div>
      )}

      {transferModal && (
        <TransferModal
          products={transferModal}
          branches={branches}
          userBranchId={userBranchId || ""}
          onClose={() => setTransferModal(null)}
          onSuccess={() => {
            fetchData();
            setSelectedIds([]);
          }}
        />
      )}
    </div>
  );
}

"use client";
import { useRef, useState, useEffect } from "react";
import { Search, Plus, Upload, Filter, Download, MoreVertical, Edit2, Trash2, X, Archive, RefreshCw, FileDown, Package, Scale, Tag, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatPrice, formatStock } from "@/lib/utils";
import { useSettings } from "@/hooks/use-settings";
import { Switch } from "@/components/ui/switch";

import { useSession } from "next-auth/react";

export default function ProductosPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const isSupervisor = role === "SUPERVISOR";
  const canDelete = role === "ADMIN" || role === "GERENTE";

  const { settings } = useSettings();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<any>(null);
  const [priceLists, setPriceLists] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    name: "",
    basePrice: 0,
    minStock: 0, // [NEW]
    stock: 0,
    categoryId: "",
    baseUnitId: "",
    ean: "",
    prices: {} // { priceListId: price }
  });
  const [loading, setLoading] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  const [viewAll, setViewAll] = useState(true); // Default: View All
  const [selectedCategory, setSelectedCategory] = useState("");

  const fetchData = async () => {
    // filterMode: viewAll ? 'all' : 'missing'
    const filterMode = viewAll ? "all" : "missing";
    const [prods, cats, unis, lists] = await Promise.all([
      fetch(`/api/products?search=${search}&filterMode=${filterMode}&categoryId=${selectedCategory}`).then(r => r.json()),
      fetch("/api/categories").then(r => r.json()),
      fetch("/api/measurement-units").then(r => r.json()),
      fetch("/api/price-lists").then(r => r.json())
    ]);


    if (Array.isArray(prods)) {
      setProducts(prods);
    } else {
      console.error("Error fetching products:", prods);
      setProducts([]);
    }

    setCategories(cats || []);
    setUnits(unis || []);
    setPriceLists(lists || []);
  };

  useEffect(() => { fetchData(); }, [search, viewAll, selectedCategory]);

  const openNew = () => {
    setForm({
      name: "",
      basePrice: 0,
      minStock: 0, // [NEW]
      stock: 0,
      categoryId: "",
      baseUnitId: units.find(u => u.isBase)?.id || "",
      ean: "",
      prices: {}
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
        const values = line.split(delimiter).map(v => v.trim());
        const obj: any = {};
        headers.forEach((h, i) => {
          if (h.includes("nombre")) obj.nombre = values[i];
          if (h.includes("cod") || h.includes("SKU")) obj.codigo = values[i];
          if (h.includes("ean") || h.includes("barra")) obj.ean = values[i];
          if (h.includes("precio")) obj.precio = values[i];
          if (h.includes("stock") && !h.includes("min")) obj.stock = values[i];
          if (h.includes("min")) obj.minStock = values[i]; // [NEW] Parser
          if (h.includes("cat")) obj.categoria = values[i];
          if (h.includes("uni")) obj.unidad = values[i];
        });
        return obj;
      });
      console.log("Parsed CSV:", parsed);
      setPreviewData(parsed);
    };
    reader.readAsText(file);
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
    const priceMap: any = {};
    p.prices?.forEach((pp: any) => {
      priceMap[pp.priceListId] = pp.price;
    });

    setForm({
      name: p.name,
      basePrice: p.basePrice || 0,
      minStock: p.minStock || 0, // [NEW]
      stock: p.stocks?.[0]?.quantity || 0,
      categoryId: p.categoryId || "",
      baseUnitId: p.baseUnitId || "",
      ean: p.ean || "",
      prices: priceMap
    });
    setModal({ type: "edit", id: p.id });
  };

  const save = async () => {
    setLoading(true);
    try {
      // Map prices object back to array for API
      const pricesArray = Object.entries(form.prices).map(([listId, price]) => ({
        priceListId: listId,
        price: Number(price)
      }));

      const body = { ...form, prices: pricesArray };

      let res;
      if (modal.type === "new") {
        res = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        res = await fetch(`/api/products/${modal.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }

      if (res.ok) {
        setModal(null);
        fetchData();
        // Opcional: mostrar un toast de éxito si estuviera disponible
      } else {
        const err = await res.json();
        alert(err.error || "Error al guardar el producto");
      }
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Error al guardar el producto");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Confirma que desea desactivar este producto?")) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (res.ok) fetchData();
      else alert("No se pudo eliminar el producto");
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Catálogo de Productos</h1>
          <p className="text-gray-500">Administra precios, unidades y stock de la sucursal</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setImportModal(true)} className="btn bg-white border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-2">
            <FileDown className="w-5 h-5" /> Importar CSV
          </button>
          <button onClick={openNew} className="btn btn-primary shadow-lg shadow-blue-100 flex items-center gap-2">
            <Plus className="w-5 h-5" /> Nuevo Producto
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="relative group w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código o EAN..."
            className="input pl-12 w-full"
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
        </div>

        <div className="flex items-center gap-2 cursor-pointer select-none bg-gray-50 px-4 py-2 rounded-lg border border-gray-200 hover:bg-white hover:border-blue-300 transition-all">
          <Switch
            checked={viewAll}
            onCheckedChange={setViewAll}
            className="data-[state=checked]:bg-blue-600"
          />
          <span className="text-sm font-bold text-gray-700">
            {viewAll ? "Todos los Productos" : "Stock Bajo / Faltante"}
          </span>
        </div>
      </div>

      <div className="card overflow-hidden p-0 border border-gray-100 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4 text-left font-bold text-gray-600 uppercase tracking-wider">Producto</th>
              <th className="px-6 py-4 text-left font-bold text-gray-600 uppercase tracking-wider">Categoría</th>
              <th className="px-6 py-4 text-right font-bold text-gray-600 uppercase tracking-wider">Precio Base</th>
              <th className="px-6 py-4 text-center font-bold text-gray-600 uppercase tracking-wider">Unidad</th>
              <th className="px-6 py-4 text-right font-bold text-gray-600 uppercase tracking-wider">Stock</th>
              <th className="px-6 py-4 text-center font-bold text-gray-600 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {(products ?? []).map(p => {
              const stock = p.stocks?.[0]?.quantity || 0;
              const unit = p.baseUnit?.symbol || "-";
              return (
                <tr key={p.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{p.name}</p>
                      <p className="text-[10px] font-mono text-gray-400 mt-1">{p.code}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg font-medium text-xs">
                      {p.category?.name || "General"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-black text-gray-900 text-base">
                    {formatPrice(p.basePrice, settings.useDecimals)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-gray-500 font-medium">{unit}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs ${Number(stock) <= 0 ? "bg-red-100 text-red-600" :
                      Number(stock) < Number(p.minStock || 0) ? "bg-orange-100 text-orange-600" :
                        "bg-green-100 text-green-600"
                      }`}>
                      {formatStock(stock, p.baseUnit)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-1 transition-opacity">

                      {/* Edit Button */}
                      <button onClick={() => openEdit(p)} className="p-2 hover:bg-white hover:shadow-md border border-transparent hover:border-gray-100 rounded-xl transition text-blue-600" title="Editar">
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Delete Button - Show if Admin/Gerente OR if Supervisor owns the product */}
                      {(canDelete || (isSupervisor && !p.branchId ? false : true)) && (
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

      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              {modal.type === "new" ? "Nuevo Producto" : "Editar Producto"}
            </h2>

            <div className="space-y-6 flex-1 overflow-auto pr-2 custom-scrollbar">
              <div>
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Nombre del Producto</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input input-lg font-bold" placeholder="Ej: Coca Cola 2.25L" />
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Precio de Venta (Base)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                    <input type="number" value={form.basePrice} onChange={e => setForm({ ...form, basePrice: Number(e.target.value) })} className="input input-lg pl-8 font-black text-blue-600" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Stock Mínimo</label>
                  <input type="number" value={form.minStock} onChange={e => setForm({ ...form, minStock: Number(e.target.value) })} className="input input-lg font-bold text-orange-600" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Stock Inicial</label>
                  <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: Number(e.target.value) })} className="input input-lg font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Unidad Base</label>
                  <div className="relative">
                    <Scale className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select value={form.baseUnitId} onChange={e => setForm({ ...form, baseUnitId: e.target.value })} className="input pl-10 appearance-none font-medium">
                      <option value="">Seleccionar unidad...</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Categoría</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} className="input pl-10 appearance-none font-medium">
                      <option value="">Sin categoría</option>
                      {(categories ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Código EAN / Barras</label>
                  <input
                    type="text"
                    value={form.ean}
                    onChange={e => setForm({ ...form, ean: e.target.value })}
                    className="input font-mono"
                    placeholder="Opcional. Se genera uno interno si está vacío."
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const code = `INT${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100)}`;
                    setForm({ ...form, ean: code });
                  }}
                  className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition"
                  title="Generar código interno"
                >
                  Generar
                </button>
                {form.ean && (
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
                    className="p-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition"
                    title="Imprimir etiqueta"
                  >
                    Imprimir
                  </button>
                )}
              </div>

              {priceLists.length > 0 && (
                <div className="pt-6 border-t mt-4">
                  <label className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4 block">Precios por Lista</label>
                  <div className="space-y-4">
                    {priceLists.map(list => (
                      <div key={list.id} className="flex items-center gap-4 bg-gray-50/50 p-3 rounded-2xl border border-gray-100 transition-all hover:border-blue-200">
                        <div className="flex-1">
                          <label className="text-xs font-black text-gray-600 uppercase tracking-wider block">{list.name}</label>
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
                              className="text-[10px] font-bold text-blue-500 hover:text-blue-700 underline flex items-center gap-1"
                              title="Calcular automáticamente"
                            >
                              Sugerido: {list.percentage > 0 ? "+" : ""}{list.percentage}% (${Math.round(form.basePrice * (1 + (list.percentage / 100)))})
                            </button>
                          )}
                        </div>
                        <div className="relative w-32">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                          <input
                            type="number"
                            value={form.prices[list.id] || ""}
                            onChange={e => setForm({
                              ...form,
                              prices: { ...form.prices, [list.id]: e.target.value }
                            })}
                            className="input input-sm pl-7 font-black text-right focus:bg-white"
                            placeholder="Manual"
                          />
                        </div>
                      </div>
                    ))}
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
    </div>
  );
}

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
              <p className="text-sm opacity-90 mb-4">El archivo debe ser un **CSV** separado por comas con las siguientes columnas (el orden no importa):</p>
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
              <button onClick={() => location.reload()} className="text-xs text-green-700 underline font-bold uppercase tracking-wider">Cambiar archivo</button>
            </div>

            <div className="flex-1 overflow-auto border border-gray-100 rounded-2xl custom-scrollbar">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">Código</th>
                    <th className="px-4 py-2 text-left">Nombre</th>
                    <th className="px-4 py-2 text-right">Precio</th>
                    <th className="px-4 py-2 text-right">Stock</th>
                    <th className="px-4 py-2 text-right">Min</th>
                    <th className="px-4 py-2 text-left">Categoría</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.slice(0, 100).map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-gray-400">{p.codigo || "-"}</td>
                      <td className="px-4 py-2 font-bold">{p.nombre}</td>
                      <td className="px-4 py-2 text-right">${p.precio || "0"}</td>
                      <td className="px-4 py-2 text-right bg-blue-50/30">{p.stock || "0"}</td>
                      <td className="px-4 py-2 text-right text-orange-500">{p.minStock || "0"}</td>
                      <td className="px-4 py-2 text-gray-500">{p.categoria || "-"}</td>
                    </tr>
                  ))}
                  {preview.length > 100 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-center font-bold text-gray-400">Y {preview.length - 100} productos más...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <button
                onClick={onClose}
                className="btn bg-gray-100 hover:bg-gray-200 text-gray-600 btn-lg font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                className="btn btn-success btn-lg shadow-xl shadow-green-100 font-bold"
                disabled={loading}
              >
                {loading ? "Importando..." : "Confirmar Importación"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

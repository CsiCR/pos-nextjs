"use client";
import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Search, Package } from "lucide-react";

export default function ProductosPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<any>(null);
  const [form, setForm] = useState({ name: "", price: 0, stock: 0, categoryId: "", ean: "" });

  const fetchData = async () => {
    const [prods, cats] = await Promise.all([
      fetch(`/api/products?search=${search}`).then(r => r.json()),
      fetch("/api/categories").then(r => r.json())
    ]);
    setProducts(prods || []);
    setCategories(cats || []);
  };

  useEffect(() => { fetchData(); }, [search]);

  const openNew = () => {
    setForm({ name: "", price: 0, stock: 0, categoryId: "", ean: "" });
    setModal({ type: "new" });
  };

  const openEdit = (p: any) => {
    setForm({ name: p.name, price: p.price, stock: p.stock, categoryId: p.categoryId || "", ean: p.ean || "" });
    setModal({ type: "edit", id: p.id });
  };

  const save = async () => {
    if (modal.type === "new") {
      await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    } else {
      await fetch(`/api/products/${modal.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    }
    setModal(null);
    fetchData();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar producto?")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">Productos</h1>
        <button onClick={openNew} className="btn btn-primary"><Plus className="w-5 h-5" /> Nuevo Producto</button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar productos..." className="input pl-12" />
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">Código</th>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Categoría</th>
              <th className="px-4 py-3 text-right">Precio</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(products ?? []).map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-sm">{p.code}</td>
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-gray-500">{p.category?.name || "-"}</td>
                <td className="px-4 py-3 text-right">${p.price?.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{p.stock}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => openEdit(p)} className="p-2 hover:bg-gray-100 rounded"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => remove(p.id)} className="p-2 hover:bg-red-50 text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Package className="w-5 h-5" /> {modal.type === "new" ? "Nuevo Producto" : "Editar Producto"}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Nombre *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Precio *</label>
                  <input type="number" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} className="input" />
                </div>
                <div>
                  <label className="text-sm text-gray-500">Stock</label>
                  <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: Number(e.target.value) })} className="input" />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Categoría</label>
                <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} className="input">
                  <option value="">Sin categoría</option>
                  {(categories ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-500">Código EAN (opcional)</label>
                <input type="text" value={form.ean} onChange={e => setForm({ ...form, ean: e.target.value })} className="input" placeholder="Se genera automáticamente si está vacío" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setModal(null)} className="btn btn-secondary flex-1">Cancelar</button>
              <button onClick={save} disabled={!form.name || !form.price} className="btn btn-primary flex-1">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

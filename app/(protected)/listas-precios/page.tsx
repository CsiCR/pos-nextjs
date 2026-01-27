"use client";
import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Search, Tag, ArrowRight } from "lucide-react";

export default function ListasPreciosPage() {
    const [lists, setLists] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [modal, setModal] = useState<any>(null);
    const [form, setForm] = useState<{ name: string, percentage: string | number }>({ name: "", percentage: 0 });
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        const res = await fetch("/api/price-lists");
        const data = await res.json();
        setLists(data || []);
    };

    useEffect(() => { fetchData(); }, []);

    const openNew = () => {
        setForm({ name: "", percentage: 0 });
        setModal({ type: "new" });
    };

    const openEdit = (list: any) => {
        setForm({ name: list.name, percentage: list.percentage || 0 });
        setModal({ type: "edit", id: list.id });
    };

    const save = async () => {
        setLoading(true);
        try {
            const url = modal.type === "new" ? "/api/price-lists" : `/api/price-lists/${modal.id}`;
            const method = modal.type === "new" ? "POST" : "PUT";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, percentage: Number(form.percentage) })
            });

            if (res.ok) {
                setModal(null);
                fetchData();
            } else {
                const err = await res.json();
                alert(err.error + (err.details ? `: ${err.details}` : ""));
            }
        } catch (error) {
            console.error("Error saving price list:", error);
        } finally {
            setLoading(false);
        }
    };

    const remove = async (id: string) => {
        if (!confirm("¿Confirma que desea eliminar esta lista?")) return;
        try {
            const res = await fetch(`/api/price-lists/${id}`, { method: "DELETE" });
            if (res.ok) fetchData();
        } catch (error) {
            console.error("Error deleting price list:", error);
        }
    };

    const filteredLists = lists.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Listas de Precios</h1>
                    <p className="text-gray-500">Configura diferentes niveles de precios (ej: Mayorista, Minorista)</p>
                </div>
                <button onClick={openNew} className="btn btn-primary flex items-center gap-2 shadow-lg shadow-blue-100">
                    <Plus className="w-5 h-5" /> Nueva Lista
                </button>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar lista..."
                    className="input pl-12 shadow-sm border-gray-100"
                />
            </div>

            <div className="grid gap-4">
                {filteredLists.map((list) => (
                    <div key={list.id} className="card group hover:border-blue-200 transition-all flex items-center justify-between p-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                                <Tag className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">{list.name}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-xs text-blue-600 font-bold uppercase tracking-widest">Activa</p>
                                    {list.percentage !== 0 && (
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${list.percentage > 0 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                                            {list.percentage > 0 ? "+" : ""}{list.percentage}% Sugerido
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => openEdit(list)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition">
                                <Edit2 className="w-5 h-5" />
                            </button>
                            <button onClick={() => remove(list.id)} className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}

                {filteredLists.length === 0 && (
                    <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                        <Tag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-400 font-bold">No hay listas de precios configuradas</p>
                    </div>
                )}
            </div>

            {modal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <h2 className="text-2xl font-black mb-8 text-gray-900">
                            {modal.type === "new" ? "Nueva Lista de Precios" : "Editar Lista"}
                        </h2>

                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Nombre de la Lista</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    placeholder="Ej: Mayorista, Distribuidores, Black Friday"
                                    className="input input-lg font-bold"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">Porcentaje de Ajuste Sugerido (%)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={form.percentage}
                                        onChange={e => setForm({ ...form, percentage: e.target.value })}
                                        className="input input-lg font-bold pr-12"
                                        placeholder="0"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-2">Usa valores positivos para aumentos y negativos para descuentos.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-10">
                            <button onClick={() => setModal(null)} className="btn bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold">Cancelar</button>
                            <button
                                onClick={save}
                                disabled={!form.name || loading}
                                className="btn btn-primary font-bold shadow-xl shadow-blue-100"
                            >
                                {loading ? "Guardando..." : "Guardar Lista"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

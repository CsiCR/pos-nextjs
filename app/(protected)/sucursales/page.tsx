"use client";
import { useState, useEffect } from "react";
import { Store, Plus, Edit, Trash2, MapPin, Phone, CheckCircle, XCircle } from "lucide-react";

export default function BranchesPage() {
    const [branches, setBranches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<boolean>(false);
    const [formData, setFormData] = useState({ name: "", address: "", phone: "", active: true });

    useEffect(() => {
        fetch("/api/branches").then(r => r.json()).then(d => {
            setBranches(d);
            setLoading(false);
        });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await fetch("/api/branches", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData)
        });
        if (res.ok) {
            const newBranch = await res.json();
            setBranches([...branches, newBranch]);
            setModal(false);
            setFormData({ name: "", address: "", phone: "", active: true });
        }
    };

    if (loading) return <div className="text-center py-20">Cargando...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Sucursales</h1>
                    <p className="text-gray-500">Gestiona los puntos de venta de tu negocio</p>
                </div>
                <button onClick={() => setModal(true)} className="btn btn-primary flex items-center gap-2">
                    <Plus className="w-5 h-5" /> Nueva Sucursal
                </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {branches.map(b => (
                    <div key={b.id} className="card hover:shadow-lg transition border-t-4 border-blue-600">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                <Store className="w-6 h-6 text-blue-600" />
                            </div>
                            {b.active ? (
                                <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                    <CheckCircle className="w-3 h-3" /> ACTIVA
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                                    <XCircle className="w-3 h-3" /> INACTIVA
                                </span>
                            )}
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">{b.name}</h2>
                        <div className="space-y-2 text-sm text-gray-600 mb-6">
                            <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" /> {b.address || "Sin dirección"}</p>
                            <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" /> {b.phone || "Sin teléfono"}</p>
                        </div>
                        <div className="flex gap-2">
                            <button className="btn btn-outline flex-1 text-sm py-2">Editar</button>
                            <button className="btn btn-outline flex-1 text-sm py-2 text-red-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200">Suspender</button>
                        </div>
                    </div>
                ))}
            </div>

            {modal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6">Nueva Sucursal</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre</label>
                                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="input" placeholder="Ej: Sucursal Centro" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Dirección</label>
                                <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="input" placeholder="Calle 123, Ciudad" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Teléfono</label>
                                <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="input" placeholder="+54 221 ..." />
                            </div>
                            <div className="flex items-center gap-3 pt-2">
                                <input type="checkbox" id="active" checked={formData.active} onChange={e => setFormData({ ...formData, active: e.target.checked })} className="w-5 h-5 text-blue-600 rounded" />
                                <label htmlFor="active" className="text-sm font-bold text-gray-700">Sucursal Activa</label>
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-6">
                                <button type="button" onClick={() => setModal(false)} className="btn btn-secondary">Cancelar</button>
                                <button type="submit" className="btn btn-primary">Crear Sucursal</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

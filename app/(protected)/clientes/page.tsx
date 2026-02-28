"use client";
import { useState, useEffect } from "react";
import { Search, UserPlus, CreditCard, History, Edit, Trash2, ArrowLeft, Plus, Save, X, AlertCircle } from "lucide-react";
import Link from "next/link";
import { formatPrice, formatDateTime } from "@/lib/utils";
import { useSettings } from "@/hooks/use-settings";
import { toast } from "sonner";

export default function ClientsPage() {
    const { settings } = useSettings();
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        document: "",
        email: "",
        phone: "",
        address: "",
        maxCredit: "0",
        active: true,
    });

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/customers?search=${search}`);
            const data = await res.json();
            setCustomers(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
            toast.error("Error al cargar clientes");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(fetchCustomers, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const handleOpenModal = (customer: any = null) => {
        if (customer) {
            setSelectedCustomer(customer);
            setFormData({
                name: customer.name,
                document: customer.document || "",
                email: customer.email || "",
                phone: customer.phone || "",
                address: customer.address || "",
                maxCredit: customer.maxCredit?.toString() || "0",
                active: customer.active,
            });
        } else {
            setSelectedCustomer(null);
            setFormData({
                name: "",
                document: "",
                email: "",
                phone: "",
                address: "",
                maxCredit: "0",
                active: true,
            });
        }
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const url = selectedCustomer ? `/api/customers/${selectedCustomer.id}` : "/api/customers";
            const method = selectedCustomer ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Error al guardar");
            }

            toast.success(selectedCustomer ? "Cliente actualizado" : "Cliente creado");
            setShowModal(false);
            fetchCustomers();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-800">Cuentas Corrientes</h1>
                    <p className="text-sm text-gray-500">Gestión de créditos y saldos de clientes</p>
                </div>
                <button onClick={() => handleOpenModal()} className="btn btn-primary flex items-center gap-2">
                    <UserPlus className="w-4 h-4" /> Nuevo Cliente
                </button>
            </div>

            <div className="flex gap-4 items-center bg-white p-2 rounded-xl shadow-sm border">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, documento o teléfono..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input pl-10 border-none bg-gray-50"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-xs font-black text-gray-400 uppercase tracking-widest border-b">
                        <tr>
                            <th className="px-6 py-4">Cliente</th>
                            <th className="px-6 py-4">Documento</th>
                            <th className="px-6 py-4 text-right">Crédito Máx.</th>
                            <th className="px-6 py-4 text-right">Saldo Actual</th>
                            <th className="px-6 py-4 text-center">Estado</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr><td colSpan={6} className="text-center py-20 text-gray-400">Cargando...</td></tr>
                        ) : customers.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-20 text-gray-400">No se encontraron clientes</td></tr>
                        ) : customers.map(customer => (
                            <tr key={customer.id} className="hover:bg-blue-50/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-gray-900">{customer.name}</div>
                                    <div className="text-[10px] text-gray-400">{customer.email || "Sin email"}</div>
                                </td>
                                <td className="px-6 py-4 font-mono text-sm text-gray-500">
                                    {customer.document || "-"}
                                </td>
                                <td className="px-6 py-4 text-right text-gray-500 font-medium">
                                    {formatPrice(customer.maxCredit, settings.useDecimals)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className={`text-lg font-black ${Number(customer.balance) > 0 ? "text-red-600" : "text-green-600"}`}>
                                        {formatPrice(customer.balance, settings.useDecimals)}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${customer.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                        {customer.active ? "Activo" : "Inactivo"}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => handleOpenModal(customer)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Editar">
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <Link href={`/clientes/${customer.id}`} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition inline-block" title="Ver Historial">
                                        <History className="w-4 h-4" />
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200">
                        <form onSubmit={handleSave}>
                            <div className="p-6 border-b flex items-center justify-between">
                                <h2 className="text-xl font-black text-gray-900">
                                    {selectedCustomer ? "Editar Cliente" : "Nuevo Cliente"}
                                </h2>
                                <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Nombre Completo *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="input"
                                        placeholder="Ej: Juan Pérez"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Documento (DNI/CUIT)</label>
                                    <input
                                        type="text"
                                        value={formData.document}
                                        onChange={e => setFormData({ ...formData, document: e.target.value })}
                                        className="input"
                                        placeholder="Solo números"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Teléfono</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        className="input"
                                        placeholder="+54 ..."
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="input"
                                        placeholder="cliente@ejemplo.com"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Dirección</label>
                                    <input
                                        type="text"
                                        value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                        className="input"
                                        placeholder="Calle 123, Ciudad"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Límite de Crédito</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.maxCredit}
                                        onChange={e => setFormData({ ...formData, maxCredit: e.target.value })}
                                        className="input"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="flex items-end pb-3 pl-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.active}
                                            onChange={e => setFormData({ ...formData, active: e.target.checked })}
                                            className="w-5 h-5 rounded-lg border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-bold text-gray-700 uppercase">Cliente Activo</span>
                                    </label>
                                </div>
                            </div>
                            <div className="p-6 bg-gray-50 flex gap-3 justify-end rounded-b-3xl">
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={isSaving} className="btn btn-primary flex items-center gap-2">
                                    {isSaving ? "Guardando..." : <Save className="w-4 h-4" />} Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

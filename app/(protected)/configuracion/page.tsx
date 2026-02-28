"use client";
import { useState, useEffect } from "react";
import { Scale, List, Plus, Trash2, Settings, ShieldCheck, AlertTriangle, RefreshCw, Pencil, Store, MapPin, Phone, CheckCircle, XCircle, Users, Shield, User, ShieldAlert, Tag } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function ConfigPage() {
    const { data: session } = useSession();
    const role = (session?.user as any)?.role;
    const isAdmin = role === "ADMIN";
    const isGerente = role === "GERENTE";
    const canEditGlobal = isAdmin || isGerente;
    const isSupervisor = role === "SUPERVISOR";
    const userBranchId = (session?.user as any)?.branchId;

    const [activeTab, setActiveTab] = useState("general");

    // --- STATES ---
    const [units, setUnits] = useState<any[]>([]);
    const [unitModal, setUnitModal] = useState(false);
    const [unitForm, setUnitForm] = useState<any>({ name: "", symbol: "", isBase: true, conversionFactor: 1, baseUnitId: "", decimals: 2 });

    const [categories, setCategories] = useState<any[]>([]);
    const [categoryModal, setCategoryModal] = useState(false);
    const [categoryForm, setCategoryForm] = useState<any>({ name: "", defaultMinStock: 0 });

    const [resetModal, setResetModal] = useState(false);
    const [resetConfirmText, setResetConfirmText] = useState("");
    const [resetLoading, setResetLoading] = useState(false);
    const [settings, setSettings] = useState({ useDecimals: true, isClearingEnabled: false });

    const [branches, setBranches] = useState<any[]>([]);
    const [branchLoading, setBranchLoading] = useState(true);
    const [branchModal, setBranchModal] = useState<boolean>(false);
    const [branchForm, setBranchForm] = useState({ name: "", address: "", phone: "", active: true });

    const [users, setUsers] = useState<any[]>([]);
    const [userModal, setUserModal] = useState(false);
    const [userForm, setUserForm] = useState({ email: "", password: "", name: "", role: "CAJERO", branchId: "" });

    // --- DATA FETCHING ---
    const fetchGeneral = () => {
        fetch("/api/measurement-units").then(r => r.json()).then(setUnits);
        fetch("/api/categories").then(r => r.json()).then(setCategories);
        fetch("/api/settings").then(r => r.json()).then(data => {
            if (data && data.useDecimals !== undefined) setSettings(data);
        });
    };

    const fetchBranches = () => {
        setBranchLoading(true);
        fetch("/api/branches").then(r => r.json()).then(d => {
            setBranches(d);
            setBranchLoading(false);
        });
    };

    const fetchUsers = async () => {
        const [uRes, bRes] = await Promise.all([
            fetch("/api/users"),
            fetch("/api/branches")
        ]);
        const uData = await uRes.json();
        const bData = await bRes.json();
        setUsers(uData || []);
        setBranches(bData || []);
    };

    useEffect(() => {
        fetchGeneral();
        fetchBranches();
        if (activeTab === "usuarios") fetchUsers();
    }, [activeTab]);

    // --- HANDLERS ---
    const handleUnitSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const method = unitForm.id ? "PUT" : "POST";
        const url = unitForm.id ? `/api/measurement-units/${unitForm.id}` : "/api/measurement-units";
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(unitForm) });
        if (res.ok) {
            const savedUnit = await res.json();
            if (unitForm.id) setUnits(units.map(u => u.id === savedUnit.id ? savedUnit : u));
            else setUnits([...units, savedUnit]);
            setUnitModal(false);
        } else { alert("Error al guardar la unidad"); }
    };

    const handleDeleteUnit = async (id: string) => {
        if (!confirm("¿Confirma que desea eliminar esta unidad de medida?")) return;
        const res = await fetch(`/api/measurement-units/${id}`, { method: "DELETE" });
        if (res.ok) setUnits(units.filter(u => u.id !== id));
        else { const err = await res.json(); alert(err.error || "Error al eliminar"); }
    };

    const handleCategorySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const method = categoryForm.id ? "PUT" : "POST";
        const url = categoryForm.id ? `/api/categories/${categoryForm.id}` : "/api/categories";
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(categoryForm) });
        if (res.ok) {
            const savedItem = await res.json();
            if (categoryForm.id) setCategories(categories.map(c => c.id === savedItem.id ? savedItem : c));
            else setCategories([...categories, savedItem]);
            setCategoryModal(false);
        } else { alert("Error al guardar categoría"); }
    };

    const handleDeleteCategory = async (id: string) => {
        if (!confirm("¿Confirma eliminar esta categoría?")) return;
        const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
        if (res.ok) setCategories(categories.filter(c => c.id !== id));
        else alert("Error al eliminar categoría");
    };

    const handleReset = async () => {
        if (resetConfirmText !== "ELIMINAR") return;
        setResetLoading(true);
        try {
            const res = await fetch("/api/admin/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmText: "ELIMINAR" }) });
            if (res.ok) { alert("Sistema restablecido con éxito."); location.reload(); }
            else { const data = await res.json(); alert(data.error || "Error al restablecer"); }
        } catch (error) { alert("Error de conexión"); } finally { setResetLoading(false); }
    };

    const handleBranchSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const method = (branchForm as any).id ? "PUT" : "POST";
        const url = (branchForm as any).id ? `/api/branches/${(branchForm as any).id}` : "/api/branches";
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(branchForm) });
        if (res.ok) { setBranchModal(false); fetchBranches(); }
        else alert("Error al guardar sucursal");
    };

    const handleToggleBranchActive = async (b: any) => {
        await fetch(`/api/branches/${b.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !b.active }) });
        fetchBranches();
    };

    const handleUserSubmit = async () => {
        const method = (userForm as any).id ? "PUT" : "POST";
        const url = (userForm as any).id ? `/api/users/${(userForm as any).id}` : "/api/users";
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...userForm, branchId: userForm.role === "GERENTE" ? "" : userForm.branchId }) });
        if (res.ok) { setUserModal(false); fetchUsers(); }
        else alert("Error al guardar usuario");
    };

    const handleToggleUserActive = async (user: any) => {
        await fetch(`/api/users/${user.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !user.active }) });
        fetchUsers();
    };

    // --- HELPERS ---
    const getRoleIcon = (role: string) => {
        if (role === "ADMIN") return <ShieldAlert className="w-5 h-5 text-red-600" />;
        if (role === "SUPERVISOR") return <Shield className="w-5 h-5 text-purple-600" />;
        if (role === "GERENTE") return <ShieldCheck className="w-5 h-5 text-green-600" />;
        return <User className="w-5 h-5 text-blue-600" />;
    };

    const formIsSafe = () => {
        if ((userForm as any).id) return userForm.name && userForm.email;
        return userForm.name && userForm.email && userForm.password;
    };

    // --- RENDER ---
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <Settings className="w-8 h-8 text-blue-600" />
                    Configuración del Sistema
                </h1>
                <p className="text-gray-500">Reglas globales, sucursales y usuarios</p>
            </div>

            <div className="flex border-b border-gray-200">
                {["general", "sucursales", "usuarios"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-3 font-medium text-sm transition-colors relative capitalize ${activeTab === tab ? "text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                    >
                        {tab}
                        {activeTab === tab && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></span>}
                    </button>
                ))}
            </div>

            {activeTab === "general" && (
                <div className="grid md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                    <div className="card h-fit">
                        <div className="flex justify-between mb-4">
                            <h2 className="font-bold flex items-center gap-2"><Scale className="w-5 h-5 text-blue-600" /> Unidades</h2>
                            {canEditGlobal && <button onClick={() => { setUnitForm({ name: "", symbol: "", isBase: true, conversionFactor: 1, baseUnitId: "", decimals: 2 }); setUnitModal(true); }} className="btn btn-sm btn-outline">Añadir</button>}
                        </div>
                        <div className="space-y-2">
                            {units.map(u => (
                                <div key={u.id} className="flex justify-between p-3 bg-gray-50 rounded-xl border">
                                    <span>{u.name} ({u.symbol})</span>
                                    {canEditGlobal && (
                                        <div className="flex gap-2">
                                            <button onClick={() => { setUnitForm(u); setUnitModal(true); }} className="text-blue-500"><Pencil className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeleteUnit(u.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card h-fit">
                        <div className="flex justify-between mb-4">
                            <h2 className="font-bold flex items-center gap-2"><Tag className="w-5 h-5 text-blue-600" /> Categorías</h2>
                            {canEditGlobal && <button onClick={() => { setCategoryForm({ name: "", defaultMinStock: 0 }); setCategoryModal(true); }} className="btn btn-sm btn-outline">Añadir</button>}
                        </div>
                        <div className="space-y-2">
                            {categories.map(c => (
                                <div key={c.id} className="flex justify-between p-3 bg-gray-50 rounded-xl border">
                                    <span>{c.name}</span>
                                    {canEditGlobal && (
                                        <div className="flex gap-2">
                                            <button onClick={() => { setCategoryForm(c); setCategoryModal(true); }} className="text-blue-500"><Pencil className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeleteCategory(c.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card h-fit space-y-4">
                        <h2 className="font-bold flex items-center gap-2"><Settings className="w-5 h-5 text-blue-600" /> Preferencias</h2>

                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border">
                            <div><p className="font-bold">Usar Decimales</p><p className="text-xs text-gray-500">Habilitar centavos.</p></div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={settings.useDecimals} onChange={async (e) => {
                                    const v = e.target.checked; setSettings({ ...settings, useDecimals: v });
                                    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...settings, useDecimals: v }) });
                                }} disabled={!canEditGlobal} />
                                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-orange-50 rounded-xl border border-orange-100">
                            <div><p className="font-bold text-orange-900">Módulo de Logística</p><p className="text-xs text-orange-700">Traspasos entre sucursales.</p></div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={settings.isClearingEnabled} onChange={async (e) => {
                                    const v = e.target.checked; setSettings({ ...settings, isClearingEnabled: v });
                                    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...settings, isClearingEnabled: v }) });
                                }} disabled={!canEditGlobal} />
                                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-orange-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                            </label>
                        </div>


                        <Link href="/listas-precios" className="btn btn-outline w-full gap-2"><List className="w-4 h-4" /> Gestionar Listas de Precios</Link>
                    </div>

                    {isAdmin && (
                        <div className="col-span-full pt-8 border-t">
                            <h2 className="text-red-600 font-bold mb-4">Zona de Peligro</h2>
                            <div className="p-6 bg-red-50 border border-red-100 rounded-2xl flex justify-between items-center">
                                <div><p className="font-bold text-red-900">Restablecer Sistema</p><p className="text-sm text-red-700">Borra ventas y stock de forma permanente.</p></div>
                                <button onClick={() => setResetModal(true)} className="btn bg-red-600 text-white hover:bg-red-700">Restablecer</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === "sucursales" && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center">
                        <h2 className="font-bold text-xl">Sucursales</h2>
                        {isAdmin && <button onClick={() => { setBranchForm({ name: "", address: "", phone: "", active: true }); setBranchModal(true); }} className="btn btn-primary"><Plus className="w-4 h-4 mr-2" /> Nueva</button>}
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                        {branches.map(b => (
                            <div key={b.id} className={`card ${!b.active ? 'opacity-60 grayscale' : ''}`}>
                                <h3 className="font-bold">{b.name}</h3>
                                <p className="text-sm text-gray-500 truncate">{b.address}</p>
                                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                                    <button onClick={() => { setBranchForm(b); setBranchModal(true); }} className="text-blue-500"><Pencil className="w-4 h-4" /></button>
                                    <button onClick={() => handleToggleBranchActive(b)} className="text-xs">{b.active ? "Pausar" : "Activar"}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === "usuarios" && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center">
                        <h2 className="font-bold text-xl">Personal</h2>
                        <button onClick={() => { setUserForm({ email: "", password: "", name: "", role: "CAJERO", branchId: isSupervisor ? userBranchId : "" }); setUserModal(true); }} className="btn btn-primary"><Plus className="w-4 h-4 mr-2" /> Nuevo</button>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                        {users.filter(u => isSupervisor ? u.branchId === userBranchId : true).map(u => (
                            <div key={u.id} className={`card ${!u.active ? 'opacity-60' : ''}`}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">{getRoleIcon(u.role)}</div>
                                    <div className="min-w-0">
                                        <p className="font-bold truncate">{u.name}</p>
                                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                                    </div>
                                </div>
                                <div className="flex justify-between text-xs pt-4 border-t">
                                    <span className="truncate">{u.branch?.name || "Global"}</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setUserForm({ ...u, password: "" }); setUserModal(true); }} className="text-blue-500">Editar</button>
                                        <button onClick={() => handleToggleUserActive(u)} className="text-gray-400">{u.active ? "Baja" : "Alta"}</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* MODALS */}
            {unitModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                        <h2 className="text-xl font-bold mb-6">Unidad de Medida</h2>
                        <form onSubmit={handleUnitSubmit} className="space-y-4">
                            <input type="text" required value={unitForm.name} onChange={e => setUnitForm({ ...unitForm, name: e.target.value })} className="input" placeholder="Nombre" />
                            <input type="text" required value={unitForm.symbol} onChange={e => setUnitForm({ ...unitForm, symbol: e.target.value })} className="input" placeholder="Símbolo" />
                            <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={unitForm.isBase} onChange={e => setUnitForm({ ...unitForm, isBase: e.target.checked })} className="w-5 h-5" /> Es Base</label>
                            <div className="grid grid-cols-2 gap-3 pt-4"><button type="button" onClick={() => setUnitModal(false)} className="btn btn-secondary">Cancelar</button><button type="submit" className="btn btn-primary">Guardar</button></div>
                        </form>
                    </div>
                </div>
            )}

            {categoryModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                        <form onSubmit={handleCategorySubmit} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">Nombre</label>
                                <input type="text" required value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} className="input" placeholder="Nombre de categoría" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">Stock Mínimo Predeterminado (para nuevos productos)</label>
                                <input type="number" step="0.001" value={categoryForm.defaultMinStock} onChange={e => setCategoryForm({ ...categoryForm, defaultMinStock: e.target.value })} className="input" placeholder="0" />
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-4"><button type="button" onClick={() => setCategoryModal(false)} className="btn btn-secondary">Cancelar</button><button type="submit" className="btn btn-primary">Guardar</button></div>
                        </form>
                    </div>
                </div>
            )}

            {branchModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                        <h2 className="text-xl font-bold mb-6">Sucursal</h2>
                        <form onSubmit={handleBranchSubmit} className="space-y-4">
                            <input type="text" required value={branchForm.name} onChange={e => setBranchForm({ ...branchForm, name: e.target.value })} className="input" placeholder="Nombre" />
                            <input type="text" value={branchForm.address} onChange={e => setBranchForm({ ...branchForm, address: e.target.value })} className="input" placeholder="Dirección" />
                            <div className="grid grid-cols-2 gap-3 pt-4"><button type="button" onClick={() => setBranchModal(false)} className="btn btn-secondary">Cancelar</button><button type="submit" className="btn btn-primary">Guardar</button></div>
                        </form>
                    </div>
                </div>
            )}

            {userModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                        <h2 className="text-xl font-bold mb-6">Usuario</h2>
                        <div className="space-y-4">
                            <input type="text" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} className="input" placeholder="Nombre" />
                            <input type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} className="input" placeholder="Email" />
                            <input type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} className="input" placeholder="Nueva Password (opcional)" />
                            <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })} className="input" disabled={isSupervisor}>
                                <option value="CAJERO">Cajero</option>
                                <option value="SUPERVISOR">Supervisor</option>
                                <option value="GERENTE">Gerente</option>
                                <option value="ADMIN">Admin</option>
                            </select>
                            {userForm.role !== "GERENTE" && (
                                <select value={userForm.branchId} onChange={e => setUserForm({ ...userForm, branchId: e.target.value })} className="input" disabled={isSupervisor}>
                                    <option value="">Sin Sucursal</option>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-6"><button onClick={() => setUserModal(false)} className="btn btn-secondary">Cancelar</button><button onClick={handleUserSubmit} disabled={!formIsSafe()} className="btn btn-primary">Guardar</button></div>
                    </div>
                </div>
            )}

            {resetModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center">
                        <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                        <h2 className="text-xl font-black mb-2">¿Confirmar Borrado?</h2>
                        <p className="text-sm text-gray-500 mb-6">Escribe ELIMINAR para proceder.</p>
                        <input type="text" value={resetConfirmText} onChange={e => setResetConfirmText(e.target.value.toUpperCase())} className="input text-center placeholder:text-gray-200" placeholder="ELIMINAR" />
                        <div className="grid grid-cols-2 gap-3 mt-8"><button onClick={() => setResetModal(false)} className="btn bg-gray-100">Cancelar</button><button onClick={handleReset} disabled={resetConfirmText !== "ELIMINAR" || resetLoading} className="btn bg-red-600 text-white">Borrar Todo</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}

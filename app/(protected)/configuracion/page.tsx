"use client";
import { useState, useEffect } from "react";
import { Scale, List, Plus, Trash2, Settings, ShieldCheck, AlertTriangle, RefreshCw, Pencil, Store, MapPin, Phone, CheckCircle, XCircle, Users, Shield, User, ShieldAlert, Tag } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { cn } from "@/lib/utils"; // Assuming utils exists, or use simple template literal

export default function ConfigPage() {
    const { data: session } = useSession();
    const role = (session?.user as any)?.role;
    const isAdmin = role === "ADMIN";
    const isGerente = role === "GERENTE";
    // Supervisor can VIEW but NOT EDIT global config, and only manage users of their branch.
    const canEditGlobal = isAdmin || isGerente;
    const isSupervisor = role === "SUPERVISOR";
    const userBranchId = (session?.user as any)?.branchId;

    const [activeTab, setActiveTab] = useState("general");

    // --- GENERAL SETTINGS STATES ---
    const [units, setUnits] = useState<any[]>([]);
    const [unitModal, setUnitModal] = useState(false);
    const [unitForm, setUnitForm] = useState<any>({ name: "", symbol: "", isBase: true, conversionFactor: 1, baseUnitId: "", decimals: 2 });

    // [NEW] CATEGORIES STATES
    const [categories, setCategories] = useState<any[]>([]);
    const [categoryModal, setCategoryModal] = useState(false);
    const [categoryForm, setCategoryForm] = useState<any>({ name: "" });

    const [resetModal, setResetModal] = useState(false);
    const [resetConfirmText, setResetConfirmText] = useState("");
    const [resetLoading, setResetLoading] = useState(false);
    const [settings, setSettings] = useState({ useDecimals: true });

    // --- BRANCHES STATES ---
    const [branches, setBranches] = useState<any[]>([]);
    const [branchLoading, setBranchLoading] = useState(true);
    const [branchModal, setBranchModal] = useState<boolean>(false);
    const [branchForm, setBranchForm] = useState({ name: "", address: "", phone: "", active: true });

    // --- USERS STATES ---
    const [users, setUsers] = useState<any[]>([]);
    const [userModal, setUserModal] = useState(false);
    const [userForm, setUserForm] = useState({ email: "", password: "", name: "", role: "CAJERO", branchId: "" });


    // --- DATA FETCHING ---
    const fetchGeneral = () => {
        fetch("/api/measurement-units").then(r => r.json()).then(setUnits);
        fetch("/api/categories").then(r => r.json()).then(setCategories); // [NEW]
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


    // --- HANDLERS: GENERAL ---
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
    const openEditUnit = (u: any) => { setUnitForm({ ...u, baseUnitId: u.baseUnitId || "" }); setUnitModal(true); };
    const openNewUnit = () => { setUnitForm({ name: "", symbol: "", isBase: true, conversionFactor: 1, baseUnitId: "", decimals: 2 }); setUnitModal(true); };

    // --- HANDLERS: CATEGORIES ---
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
        } else {
            const err = await res.json();
            alert("Error: " + (err.error || "No se pudo guardar la categoría"));
        }
    };

    const handleDeleteCategory = async (id: string) => {
        if (!confirm("¿Confirma que desea eliminar esta categoría? Se verificará si está en uso.")) return;
        const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
        if (res.ok) {
            setCategories(categories.filter(c => c.id !== id));
        } else {
            const err = await res.json();
            alert(err.error || "No se pudo eliminar la categoría");
        }
    };

    const openEditCategory = (c: any) => { setCategoryForm({ ...c }); setCategoryModal(true); };
    const openNewCategory = () => { setCategoryForm({ name: "" }); setCategoryModal(true); };

    const handleReset = async () => {
        if (resetConfirmText !== "ELIMINAR") return;
        setResetLoading(true);
        try {
            const res = await fetch("/api/admin/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmText: "ELIMINAR" }) });
            if (res.ok) { alert("Sistema restablecido con éxito. La página se recargará."); location.reload(); }
            else { const data = await res.json(); alert(data.error || "Error al restablecer el sistema."); }
        } catch (error) { alert("Error de conexión con el servidor."); } finally { setResetLoading(false); }
    };

    // --- HANDLERS: BRANCHES ---
    const handleBranchSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const method = (branchForm as any).id ? "PUT" : "POST";
        const url = (branchForm as any).id ? `/api/branches/${(branchForm as any).id}` : "/api/branches";

        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(branchForm) });
        if (res.ok) {
            setBranchModal(false);
            setBranchForm({ name: "", address: "", phone: "", active: true });
            fetchBranches();
        } else {
            alert("Error al guardar sucursal");
        }
    };

    const handleToggleBranchActive = async (b: any) => {
        await fetch(`/api/branches/${b.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: !b.active })
        });
        fetchBranches();
    };

    const handleDeleteBranch = async (id: string, force = false) => {
        const confirmMsg = force
            ? "⚠️ ¡ATENCIÓN! ESTA ACCIÓN ELIMINARÁ TODAS LAS VENTAS, STOCK Y TURNOS DE ESTA SUCURSAL PARA SIEMPRE.\n\n¿Estás seguro?"
            : "¿Eliminar sucursal? Si tiene ventas, fallará.";

        if (!confirm(confirmMsg)) return;

        const res = await fetch(`/api/branches/${id}${force ? '?force=true' : ''}`, { method: "DELETE" });
        if (res.ok) {
            fetchBranches();
            if (force) alert("Sucursal y datos asociados eliminados correctamente.");
        } else {
            const data = await res.json();
            if (data.requiresForce) {
                if (confirm(`${data.error}\n\n¿Desea FORZAR la eliminación? Se borrarán todos los datos históricos.`)) {
                    handleDeleteBranch(id, true);
                }
            } else {
                alert(data.error || "Error al eliminar");
            }
        }
    };

    const openEditBranch = (b: any) => {
        setBranchForm({ ...b });
        setBranchModal(true);
    };

    const openNewBranch = () => {
        setBranchForm({ name: "", address: "", phone: "", active: true });
        setBranchModal(true);
    };


    // --- HANDLERS: USERS ---
    const handleUserSubmit = async () => {
        const method = (userForm as any).id ? "PUT" : "POST";
        const url = (userForm as any).id ? `/api/users/${(userForm as any).id}` : "/api/users";

        try {
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...userForm,
                    // If Gerente, ensure branchId is empty string if not set (API handles the logic)
                    branchId: userForm.role === "GERENTE" ? "" : userForm.branchId
                })
            });

            if (res.ok) {
                setUserModal(false);
                setUserForm({ email: "", password: "", name: "", role: "CAJERO", branchId: "" });
                fetchUsers();
            } else {
                const err = await res.json();
                alert("Error: " + (err.error || "No se pudo guardar el usuario"));
            }
        } catch (e) {
            alert("Error de red o servidor");
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (!confirm("¿Eliminar este usuario irreversiblemente?")) return;
        const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
        if (res.ok) {
            fetchUsers();
        } else {
            const err = await res.json();
            alert(err.error || "Error al eliminar");
        }
    };

    const handleToggleUserActive = async (user: any) => {
        await fetch(`/api/users/${user.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: !user.active })
        });
        fetchUsers();
    };

    const openEditUser = (u: any) => {
        setUserForm({
            ...u,
            password: "", // Don't fill password
            branchId: u.branchId || ""
        });
        setUserModal(true);
    };

    const openNewUser = () => {
        setUserForm({
            email: "",
            password: "",
            name: "",
            role: "CAJERO",
            branchId: isSupervisor ? userBranchId : ""
        });
        setUserModal(true);
    };


    // --- HELPERS ---
    const getRoleIcon = (role: string) => {
        if (role === "ADMIN") return <ShieldAlert className="w-6 h-6 text-red-600" />;
        if (role === "SUPERVISOR") return <Shield className="w-6 h-6 text-purple-600" />;
        if (role === "GERENTE") return <ShieldCheck className="w-6 h-6 text-green-600" />;
        return <User className="w-6 h-6 text-blue-600" />;
    };
    const getRoleColor = (role: string) => {
        if (role === "ADMIN") return "bg-red-100 text-red-700";
        if (role === "SUPERVISOR") return "bg-purple-100 text-purple-700";
        if (role === "GERENTE") return "bg-green-100 text-green-700";
        return "bg-blue-100 text-blue-700";
    };

    // --- RENDER CONTENT ---
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <Settings className="w-8 h-8 text-blue-600" />
                    Configuración del Sistema
                </h1>
                <p className="text-gray-500">Maneja las reglas globales, sucursales y usuarios</p>
            </div>

            {/* TABS HEADER */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab("general")}
                    className={`px-6 py-3 font-medium text-sm transition-colors relative ${activeTab === "general" ? "text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                >
                    <span className="flex items-center gap-2"><Settings className="w-4 h-4" /> General</span>
                    {activeTab === "general" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></span>}
                </button>
                <button
                    onClick={() => setActiveTab("sucursales")}
                    className={`px-6 py-3 font-medium text-sm transition-colors relative ${activeTab === "sucursales" ? "text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                >
                    <span className="flex items-center gap-2"><Store className="w-4 h-4" /> Sucursales</span>
                    {activeTab === "sucursales" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></span>}
                </button>
                <button
                    onClick={() => setActiveTab("usuarios")}
                    className={`px-6 py-3 font-medium text-sm transition-colors relative ${activeTab === "usuarios" ? "text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                >
                    <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Usuarios</span>
                    {activeTab === "usuarios" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></span>}
                </button>
            </div>

            {/* TAB CONTENT: GENERAL */}
            {activeTab === "general" && (
                <div className="grid md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                    {/* Units Management */}
                    <div className="card h-fit">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Scale className="w-5 h-5 text-blue-600" /> Unidades de Medida
                            </h2>
                            {canEditGlobal && (
                                <button onClick={openNewUnit} className="btn btn-outline btn-sm">
                                    <Plus className="w-4 h-4" /> Añadir
                                </button>
                            )}
                        </div>
                        <div className="space-y-3">
                            {Array.isArray(units) && units.map(u => (
                                <div key={u.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <div>
                                        <p className="font-bold text-gray-900">{u.name} ({u.symbol})</p>
                                        <p className="text-xs text-gray-500">{u.isBase ? "Unidad Base" : `Factor: ${u.conversionFactor}`}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {u.isBase && <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">BASE</span>}
                                        {canEditGlobal && (
                                            <>
                                                <button onClick={() => openEditUnit(u)} className="text-gray-300 hover:text-blue-500"><Pencil className="w-4 h-4" /></button>
                                                <button className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* [NEW] Categories Management */}
                    <div className="card h-fit">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Tag className="w-5 h-5 text-blue-600" /> Categorías de Productos
                            </h2>
                            {canEditGlobal && (
                                <button onClick={openNewCategory} className="btn btn-outline btn-sm">
                                    <Plus className="w-4 h-4" /> Añadir
                                </button>
                            )}
                        </div>
                        <div className="space-y-3">
                            {Array.isArray(categories) && categories.map(c => (
                                <div key={c.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 transition-all hover:bg-white hover:border-blue-200">
                                    <div>
                                        <p className="font-bold text-gray-900">{c.name}</p>
                                    </div>
                                    {canEditGlobal && (
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => openEditCategory(c)} className="text-gray-300 hover:text-blue-500 transition-colors"><Pencil className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeleteCategory(c.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {categories.length === 0 && (
                                <p className="text-center py-4 text-gray-400 text-sm italic">No hay categorías registradas.</p>
                            )}
                        </div>
                    </div>

                    {/* Pricing & Preferences */}
                    <div className="card h-fit space-y-6">
                        <div>
                            <Link href="/listas-precios" className="flex items-center gap-2 mb-2 hover:text-blue-600 transition-colors group cursor-pointer">
                                <List className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
                                <h2 className="text-xl font-bold">Listas de Precios</h2>
                            </Link>
                            <p className="text-gray-400 text-sm italic">Gestión de múltiples listas de precios habilitada en el menú principal.</p>
                        </div>
                        <div className="pt-6 border-t border-gray-100">
                            <div className="flex items-center gap-2 mb-4">
                                <Settings className="w-5 h-5 text-blue-600" />
                                <h2 className="text-xl font-bold">Preferencias del Sistema</h2>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div>
                                    <p className="font-bold text-gray-900">Usar Decimales</p>
                                    <p className="text-xs text-gray-500">Habilitar centavos en precios y stock (ej: $10.50)</p>
                                </div>
                                <label className={`relative inline-flex items-center ${canEditGlobal ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                                    <input type="checkbox" className="sr-only peer" checked={settings.useDecimals}
                                        disabled={!canEditGlobal}
                                        onChange={async (e) => {
                                            if (!canEditGlobal) return;
                                            const newVal = e.target.checked;
                                            setSettings({ ...settings, useDecimals: newVal });
                                            await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ useDecimals: newVal }) });
                                        }}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Danger Zone (ADMIN Only) */}
                    {isAdmin && (
                        <div className="col-span-1 md:col-span-2 pt-12 border-t border-red-100">
                            <h2 className="text-xl font-bold text-red-600 flex items-center gap-2 mb-4">
                                <AlertTriangle className="w-6 h-6" /> Zona de Peligro
                            </h2>
                            <div className="bg-red-50 border border-red-100 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="max-w-xl">
                                    <p className="text-lg font-black text-red-900">Restablecer Sistema de Fábrica</p>
                                    <p className="text-sm text-red-700 opacity-80 mt-1 leading-relaxed">
                                        Esta acción es **irreversible**. Se eliminarán definitivamente todas las **Ventas, Turnos, Productos, Stock y Listas de Precios y Unidades de Medida**.
                                        Se mantendrán únicamente los Usuarios, Sucursales y configuraciones base. Ideal para pasar de Demo a Producción.
                                    </p>
                                </div>
                                <button onClick={() => setResetModal(true)} className="btn bg-red-600 text-white hover:bg-red-700 shadow-xl shadow-red-200 px-8 min-w-[200px]">
                                    <RefreshCw className={`w-4 h-4 mr-2 ${resetLoading ? 'animate-spin' : ''}`} /> Restablecer Todo
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: SUCURSALES */}
            {activeTab === "sucursales" && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">Listado de Sucursales</h2>
                            <p className="text-sm text-gray-500">Gestiona los puntos de venta</p>
                        </div>
                        {isAdmin && (
                            <button onClick={openNewBranch} className="btn btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nueva Sucursal</button>
                        )}
                    </div>
                    {branchLoading ? <div className="text-center py-10">Cargando...</div> : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {branches.map(b => (
                                <div key={b.id} className={`card hover:shadow-lg transition border-t-4 border-blue-600 ${!b.active ? 'opacity-70 bg-gray-50' : ''}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                            <Store className="w-6 h-6 text-blue-600" />
                                        </div>
                                        {b.active ? (
                                            <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full"><CheckCircle className="w-3 h-3" /> ACTIVA</span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full"><XCircle className="w-3 h-3" /> INACTIVA</span>
                                        )}
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                                        {b.name}
                                        {!b.active && <span className="text-[10px] text-red-500 bg-red-100 px-1.5 py-0.5 rounded">INACTIVA</span>}
                                    </h2>
                                    <div className="space-y-2 text-sm text-gray-600 mb-6">
                                        <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" /> {b.address || "Sin dirección"}</p>
                                        <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" /> {b.phone || "Sin teléfono"}</p>
                                    </div>
                                    <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                                        <button onClick={() => openEditBranch(b)} className="text-gray-300 hover:text-blue-500 p-2" title="Editar"><Pencil className="w-4 h-4" /></button>
                                        <button onClick={() => handleToggleBranchActive(b)} className={`text-xs font-bold px-2 py-1 rounded ${b.active ? 'text-gray-400 hover:text-red-500' : 'text-green-500 hover:bg-green-50'}`}>
                                            {b.active ? "DESACTIVAR" : "ACTIVAR"}
                                        </button>
                                        {(isAdmin || role === "GERENTE") && (
                                            <button onClick={() => handleDeleteBranch(b.id)} className="text-gray-300 hover:text-red-600 p-2" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: USUARIOS */}
            {activeTab === "usuarios" && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">Gestión de Personal</h2>
                            <p className="text-sm text-gray-500">Administra accesos y roles</p>
                        </div>
                        <button onClick={openNewUser} className="btn btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nuevo Usuario</button>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {(users ?? [])
                            .filter(u => {
                                // Supervisor only sees:
                                // 1. Users in their own branch
                                // 2. Not ADMINs
                                // 3. Not themselves (or yes themselves? usually yes)
                                if (isSupervisor) {
                                    return u.branchId === userBranchId && u.role !== "ADMIN" && u.role !== "GERENTE";
                                }
                                return true;
                            })
                            .map(u => (
                                <div key={u.id} className={`card hover:shadow-md transition border border-gray-100 ${!u.active ? 'opacity-60 bg-gray-50' : ''}`}>
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${u.active ? getRoleColor(u.role).split(" ")[0] : 'bg-gray-200'}`}>
                                            {getRoleIcon(u.role)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-900 truncate flex items-center gap-2">
                                                {u.name}
                                                {!u.active && <span className="text-[10px] text-red-500 bg-red-100 px-1.5 py-0.5 rounded">INACTIVO</span>}
                                            </p>
                                            <p className="text-sm text-gray-500 truncate">{u.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <Store className="w-4 h-4 text-gray-400" />
                                            <span className="font-medium">{u.branch?.name || "Global / Sin Sucursal"}</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button onClick={() => openEditUser(u)} className="text-gray-300 hover:text-blue-500" title="Editar"><Pencil className="w-4 h-4" /></button>
                                            <div className="h-4 w-[1px] bg-gray-200"></div>
                                            <button onClick={() => handleToggleUserActive(u)} className={`text-xs font-bold ${u.active ? 'text-gray-400 hover:text-red-500' : 'text-green-500'}`}>
                                                {u.active ? "DESACTIVAR" : "ACTIVAR"}
                                            </button>
                                            {isAdmin && (
                                                <button onClick={() => handleDeleteUser(u.id)} className="text-gray-300 hover:text-red-600 pl-2" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* --- MODALS --- */}
            {unitModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6">{unitForm.id ? "Editar Unidad" : "Nueva Unidad"}</h2>
                        <form onSubmit={handleUnitSubmit} className="space-y-4">
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Nombre</label><input type="text" required value={unitForm.name} onChange={e => setUnitForm({ ...unitForm, name: e.target.value })} className="input" placeholder="Ej: Kilogramo" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Símbolo</label><input type="text" required value={unitForm.symbol} onChange={e => setUnitForm({ ...unitForm, symbol: e.target.value })} className="input" placeholder="Ej: kg" /></div>
                                <div className="flex flex-col justify-end pb-3"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={unitForm.isBase} onChange={e => setUnitForm({ ...unitForm, isBase: e.target.checked })} className="w-5 h-5 text-blue-600 rounded" /><span className="text-sm font-bold text-gray-700">Es Base</span></label></div>
                            </div>
                            {!unitForm.isBase && (<div><label className="block text-sm font-bold text-gray-700 mb-1">Factor de Conversión</label><input type="number" step="0.000001" required value={unitForm.conversionFactor} onChange={e => setUnitForm({ ...unitForm, conversionFactor: parseFloat(e.target.value) })} className="input" placeholder="Ej: 1000" /></div>)}
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Decimales</label><input type="number" min="0" max="4" required value={unitForm.decimals} onChange={e => setUnitForm({ ...unitForm, decimals: parseInt(e.target.value) })} className="input" /></div>
                            <div className="grid grid-cols-2 gap-3 pt-6"><button type="button" onClick={() => setUnitModal(false)} className="btn btn-secondary">Cancelar</button><button type="submit" className="btn btn-primary">Guardar</button></div>
                        </form>
                    </div>
                </div>
            )}

            {categoryModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <Tag className="w-6 h-6 text-blue-600" />
                            {categoryForm.id ? "Editar Categoría" : "Nueva Categoría"}
                        </h2>
                        <form onSubmit={handleCategorySubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre de la Categoría</label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    value={categoryForm.name}
                                    onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                                    className="input focus:ring-4 focus:ring-blue-100"
                                    placeholder="Ej: Bebidas, Lácteos, etc."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3 pt-6">
                                <button type="button" onClick={() => setCategoryModal(false)} className="btn btn-secondary">Cancelar</button>
                                <button type="submit" className="btn btn-primary shadow-xl shadow-blue-100">Guardar Categoría</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {branchModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6">{(branchForm as any).id ? "Editar Sucursal" : "Nueva Sucursal"}</h2>
                        <form onSubmit={handleBranchSubmit} className="space-y-4">
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Nombre</label><input type="text" required value={branchForm.name} onChange={e => setBranchForm({ ...branchForm, name: e.target.value })} className="input" placeholder="Ej: Sucursal Centro" /></div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Dirección</label><input type="text" value={branchForm.address} onChange={e => setBranchForm({ ...branchForm, address: e.target.value })} className="input" placeholder="Calle 123" /></div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Teléfono</label><input type="text" value={branchForm.phone} onChange={e => setBranchForm({ ...branchForm, phone: e.target.value })} className="input" placeholder="+54 221 ..." /></div>
                            <div className="flex items-center gap-3 pt-2"><input type="checkbox" id="active" checked={branchForm.active} onChange={e => setBranchForm({ ...branchForm, active: e.target.checked })} className="w-5 h-5 text-blue-600 rounded" /><label htmlFor="active" className="text-sm font-bold text-gray-700">Sucursal Activa</label></div>
                            <div className="grid grid-cols-2 gap-3 pt-6"><button type="button" onClick={() => setBranchModal(false)} className="btn btn-secondary">Cancelar</button><button type="submit" className="btn btn-primary">Guardar</button></div>
                        </form>
                    </div>
                </div>
            )}

            {userModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Users className="w-6 h-6 text-blue-600" /> {(userForm as any).id ? "Editar Usuario" : "Nuevo Usuario"}</h2>
                        <div className="space-y-4">
                            <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Nombre Completo</label><input type="text" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} className="input" placeholder="Ej: Juan Pérez" /></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Email Acceso</label><input type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} className="input" placeholder="juan@ejemplo.com" /></div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Contraseña {(userForm as any).id && <span className="text-gray-400 font-normal">(Opcional si no desea cambiar)</span>}</label>
                                <input type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} className="input" placeholder="••••••••" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Rol</label>
                                    <select
                                        value={userForm.role}
                                        onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                                        className="input"
                                        disabled={isSupervisor}
                                    >
                                        <option value="CAJERO">Cajero</option>
                                        {!isSupervisor && (
                                            <>
                                                <option value="SUPERVISOR">Supervisor</option>
                                                <option value="ADMIN">Administrador</option>
                                                <option value="GERENTE">Gerente</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <div>
                                    {userForm.role !== "GERENTE" && (
                                        <>
                                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Sucursal</label>
                                            <select
                                                value={userForm.branchId}
                                                onChange={e => setUserForm({ ...userForm, branchId: e.target.value })}
                                                className="input"
                                                disabled={isSupervisor}
                                            >
                                                <option value="">Seleccionar...</option>
                                                {branches.map(b => (
                                                    <option key={b.id} value={b.id}>{b.name}</option>
                                                ))}
                                            </select>
                                        </>
                                    )}
                                    {userForm.role === "GERENTE" && (
                                        <div className="pt-6 text-xs text-green-600 font-bold italic">
                                            Acceso Global (Sin Sucursal)
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-8">
                            <button onClick={() => setUserModal(false)} className="btn btn-secondary">Cancelar</button>
                            <button onClick={handleUserSubmit} disabled={!formIsSafe()} className="btn btn-primary shadow-lg shadow-blue-100">Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {resetModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-6 mx-auto"><AlertTriangle className="w-10 h-10 text-red-600" /></div>
                        <h2 className="text-2xl font-black text-center text-gray-900 mb-2">¿Estás absolutamente seguro?</h2>
                        <p className="text-sm text-center text-gray-500 mb-6">Esta acción borrará toda la información comercial de la base de datos. No hay vuelta atrás.</p>
                        <div className="bg-gray-50 rounded-2xl p-4 mb-6"><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 text-center">Escribe <strong>ELIMINAR</strong> para confirmar</label><input type="text" value={resetConfirmText} onChange={e => setResetConfirmText(e.target.value.toUpperCase())} className="input text-center font-black text-red-600 tracking-widest" placeholder="ELIMINAR" /></div>
                        <div className="grid grid-cols-2 gap-4"><button onClick={() => { setResetModal(false); setResetConfirmText(""); }} disabled={resetLoading} className="btn bg-gray-100 text-gray-600 hover:bg-gray-200">Cancelar</button><button onClick={handleReset} disabled={resetConfirmText !== "ELIMINAR" || resetLoading} className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-30 disabled:grayscale">{resetLoading ? "Borrando..." : "Confirmar"}</button></div>
                    </div>
                </div>
            )}
        </div>
    );

    function formIsSafe() {
        if ((userForm as any).id) return userForm.name && userForm.email; // Password optional on edit
        return userForm.name && userForm.email && userForm.password;
    }
}

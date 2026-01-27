"use client";
import { useState, useEffect } from "react";
import { Plus, Users, Shield, User, Store, ShieldAlert } from "lucide-react";

export default function UsuariosPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "CAJERO", branchId: "" });

  const fetchData = async () => {
    const [uRes, bRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/branches")
    ]);
    const uData = await uRes.json();
    const bData = await bRes.json();
    setUsers(uData || []);
    setBranches(bData || []);
  };

  useEffect(() => { fetchData(); }, []);

  const save = async () => {
    // Validation
    if (!form.name.trim()) {
      alert("El nombre es obligatorio");
      return;
    }
    if (!form.email.trim()) {
      alert("El email es obligatorio");
      return;
    }
    if (!form.password.trim()) {
      alert("La contraseña es obligatoria");
      return;
    }
    if ((form.role === "CAJERO" || form.role === "SUPERVISOR" || form.role === "GERENTE") && !form.branchId) {
      alert("Debe asignar una sucursal para este rol");
      return;
    }

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al guardar");
      }

      setModal(false);
      setForm({ email: "", password: "", name: "", role: "CAJERO", branchId: "" });
      fetchData();
      alert("Usuario creado correctamente");
    } catch (e: any) {
      alert(e.message);
    }
  };

  const getRoleIcon = (role: string) => {
    if (role === "ADMIN") return <ShieldAlert className="w-6 h-6 text-red-600" />;
    if (role === "SUPERVISOR") return <Shield className="w-6 h-6 text-purple-600" />;
    return <User className="w-6 h-6 text-blue-600" />;
  };

  const getRoleColor = (role: string) => {
    if (role === "ADMIN") return "bg-red-100 text-red-700";
    if (role === "SUPERVISOR") return "bg-purple-100 text-purple-700";
    return "bg-blue-100 text-blue-700";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-500">Gestiona los accesos y roles de tu personal</p>
        </div>
        <button onClick={() => setModal(true)} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" /> Nuevo Usuario
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(users ?? []).map(u => (
          <div key={u.id} className="card hover:shadow-md transition border border-gray-100">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${getRoleColor(u.role).split(" ")[0]}`}>
                {getRoleIcon(u.role)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">{u.name}</p>
                <p className="text-sm text-gray-500 truncate">{u.email}</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Store className="w-4 h-4 text-gray-400" />
                <span className="font-medium">{u.branch?.name || "Sin Sucursal"}</span>
              </div>
              <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${getRoleColor(u.role)}`}>
                {u.role}
              </span>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              Nuevo Usuario
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Nombre Completo</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" placeholder="Ej: Juan Pérez" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Email Acceso</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input" placeholder="juan@ejemplo.com" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Contraseña</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="input" placeholder="••••••••" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Rol</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="input">
                    <option value="CAJERO">Cajero</option>
                    <option value="SUPERVISOR">Supervisor</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Sucursal</label>
                  <select value={form.branchId} onChange={e => setForm({ ...form, branchId: e.target.value })} className="input">
                    <option value="">Seleccionar...</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-8">
              <button onClick={() => setModal(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={save} className="btn btn-primary shadow-lg shadow-blue-100">Crear Usuario</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import { useState, useEffect } from "react";
import { Plus, Users, Shield, User } from "lucide-react";

export default function UsuariosPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "CAJERO" });

  const fetchUsers = async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data || []);
  };

  useEffect(() => { fetchUsers(); }, []);

  const save = async () => {
    await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setModal(false);
    setForm({ email: "", password: "", name: "", role: "CAJERO" });
    fetchUsers();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <button onClick={() => setModal(true)} className="btn btn-primary"><Plus className="w-5 h-5" /> Nuevo Usuario</button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(users ?? []).map(u => (
          <div key={u.id} className="card flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${u.role === "SUPERVISOR" ? "bg-purple-100" : "bg-blue-100"}`}>
              {u.role === "SUPERVISOR" ? <Shield className="w-6 h-6 text-purple-600" /> : <User className="w-6 h-6 text-blue-600" />}
            </div>
            <div className="flex-1">
              <p className="font-semibold">{u.name}</p>
              <p className="text-sm text-gray-500">{u.email}</p>
              <span className={`text-xs px-2 py-1 rounded-full ${u.role === "SUPERVISOR" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{u.role}</span>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Users className="w-5 h-5" /> Nuevo Usuario</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Nombre *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" />
              </div>
              <div>
                <label className="text-sm text-gray-500">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input" />
              </div>
              <div>
                <label className="text-sm text-gray-500">Contraseña *</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="input" />
              </div>
              <div>
                <label className="text-sm text-gray-500">Rol</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="input">
                  <option value="CAJERO">Cajero</option>
                  <option value="SUPERVISOR">Supervisor</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setModal(false)} className="btn btn-secondary flex-1">Cancelar</button>
              <button onClick={save} disabled={!form.name || !form.email || !form.password} className="btn btn-primary flex-1">Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

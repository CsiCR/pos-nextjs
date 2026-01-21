"use client";
import { useState, useEffect, useRef } from "react";
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, ArrowRightLeft, ShoppingCart, AlertCircle, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface CartItem {
  productId: string;
  code: string;
  name: string;
  price: number;
  quantity: number;
}

export default function POSPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [hasShift, setHasShift] = useState<boolean | null>(null);
  const [payment, setPayment] = useState<{ method: string; cash: number } | null>(null);
  const [success, setSuccess] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/shifts/current").then(r => r.json()).then(d => setHasShift(!!d?.id));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/products?search=${search}`).then(r => r.json()).then(setProducts);
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  const addToCart = (p: any) => {
    setCart(prev => {
      const exists = prev.find(i => i.productId === p.id);
      if (exists) return prev.map(i => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { productId: p.id, code: p.code, name: p.name, price: p.price, quantity: 1 }];
    });
    setSearch("");
    searchRef.current?.focus();
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => i.productId === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  };

  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.productId !== id));

  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const handlePayment = async () => {
    if (!payment) return;
    setLoading(true);
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart.map(i => ({ productId: i.productId, quantity: i.quantity })), paymentMethod: payment.method, cashReceived: payment.cash })
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setSuccess({ ...data, change: payment.method === "EFECTIVO" ? payment.cash - total : 0 });
      setCart([]);
      setPayment(null);
    } else {
      alert(data.error);
    }
  };

  if (hasShift === null) return <div className="text-center py-20">Cargando...</div>;
  if (!hasShift) {
    return (
      <div className="card text-center py-16">
        <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">No hay turno abierto</h2>
        <p className="text-gray-500 mb-6">Debes abrir un turno antes de vender</p>
        <button onClick={() => router.push("/turnos")} className="btn btn-primary">Ir a Turnos</button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="card text-center py-16 max-w-lg mx-auto">
        <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">¡Venta Exitosa!</h2>
        <p className="text-4xl font-bold text-green-600 mb-4">${total.toLocaleString()}</p>
        {success.change > 0 && <p className="text-2xl mb-4">Vuelto: <span className="font-bold">${success.change.toLocaleString()}</span></p>}
        <button onClick={() => { setSuccess(null); searchRef.current?.focus(); }} className="btn btn-primary btn-lg">Nueva Venta</button>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4 h-[calc(100vh-120px)]">
      {/* Products */}
      <div className="lg:col-span-2 flex flex-col">
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6" />
          <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por código o nombre..." className="input input-lg pl-14" autoFocus />
        </div>
        <div className="flex-1 overflow-auto grid grid-cols-2 md:grid-cols-3 gap-3">
          {(products ?? []).slice(0, 12).map(p => (
            <button key={p.id} onClick={() => addToCart(p)} className="card hover:shadow-lg transition text-left">
              <p className="text-xs text-gray-400 font-mono">{p.code}</p>
              <p className="font-semibold truncate">{p.name}</p>
              <p className="text-xl font-bold text-blue-600">${p.price?.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Stock: {p.stock}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Cart */}
      <div className="card flex flex-col h-full">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingCart className="w-5 h-5 text-blue-600" />
          <h2 className="font-bold">Carrito ({cart.length})</h2>
        </div>
        <div className="flex-1 overflow-auto space-y-2">
          {cart.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Carrito vacío</p>
          ) : cart.map(item => (
            <div key={item.productId} className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.name}</p>
                <p className="text-sm text-gray-500">${item.price?.toLocaleString()} c/u</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => updateQty(item.productId, -1)} className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-300"><Minus className="w-4 h-4" /></button>
                <span className="w-8 text-center font-bold">{item.quantity}</span>
                <button onClick={() => updateQty(item.productId, 1)} className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-300"><Plus className="w-4 h-4" /></button>
              </div>
              <button onClick={() => removeItem(item.productId)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 className="w-5 h-5" /></button>
            </div>
          ))}
        </div>

        <div className="border-t pt-4 mt-4 space-y-4">
          <div className="flex justify-between text-2xl font-bold">
            <span>Total:</span>
            <span className="text-blue-600">${total.toLocaleString()}</span>
          </div>

          {!payment ? (
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setPayment({ method: "EFECTIVO", cash: 0 })} disabled={!cart.length} className="btn btn-success flex-col py-4">
                <Banknote className="w-6 h-6" /> Efectivo
              </button>
              <button onClick={() => setPayment({ method: "TARJETA", cash: 0 })} disabled={!cart.length} className="btn btn-primary flex-col py-4">
                <CreditCard className="w-6 h-6" /> Tarjeta
              </button>
              <button onClick={() => setPayment({ method: "TRANSFERENCIA", cash: 0 })} disabled={!cart.length} className="btn btn-secondary flex-col py-4">
                <ArrowRightLeft className="w-6 h-6" /> Transfer
              </button>
            </div>
          ) : payment.method === "EFECTIVO" ? (
            <div className="space-y-3">
              <input type="number" value={payment.cash || ""} onChange={e => setPayment({ ...payment, cash: Number(e.target.value) })} placeholder="Monto recibido" className="input input-lg text-center" autoFocus />
              {payment.cash >= total && <p className="text-center text-xl">Vuelto: <span className="font-bold text-green-600">${(payment.cash - total).toLocaleString()}</span></p>}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPayment(null)} className="btn btn-secondary">Cancelar</button>
                <button onClick={handlePayment} disabled={payment.cash < total || loading} className="btn btn-success">{loading ? "Procesando..." : "Confirmar"}</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-center text-lg">Pago con {payment.method}</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPayment(null)} className="btn btn-secondary">Cancelar</button>
                <button onClick={handlePayment} disabled={loading} className="btn btn-success">{loading ? "Procesando..." : "Confirmar"}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

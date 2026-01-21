"use client";
import { useState, useEffect, useRef } from "react";
import { Search, Package } from "lucide-react";

export default function VerificadorPage() {
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!search) { setProduct(null); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/products?search=${search}`);
      const data = await res.json();
      setProduct(data?.[0] || null);
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Verificador de Precios</h1>
        <p className="text-gray-500">Escanea o escribe el código del producto</p>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6" />
        <input ref={inputRef} type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Código o nombre del producto..." className="input input-lg pl-14 text-center" autoFocus />
      </div>

      {loading && <div className="text-center py-12 text-gray-400">Buscando...</div>}

      {!loading && product && (
        <div className="card text-center py-12">
          <Package className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <p className="text-sm text-gray-400 font-mono mb-2">{product.code}</p>
          <h2 className="text-2xl font-bold mb-4">{product.name}</h2>
          <p className="text-6xl font-bold text-blue-600 mb-4">${product.price?.toLocaleString()}</p>
          <div className="flex justify-center gap-4 text-sm text-gray-500">
            <span>Stock: {product.stock}</span>
            {product.category && <span>Categoría: {product.category.name}</span>}
          </div>
        </div>
      )}

      {!loading && search && !product && (
        <div className="card text-center py-12">
          <p className="text-gray-400">Producto no encontrado</p>
        </div>
      )}
    </div>
  );
}

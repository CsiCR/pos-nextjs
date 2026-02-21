"use client";
import { useState, useEffect, useRef } from "react";
import { Search, Package, ScanBarcode } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useSession } from "next-auth/react";

export default function VerificadorPage() {
  const { data: session } = useSession() || {};
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [onlyMyBranch, setOnlyMyBranch] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const role = (session?.user as any)?.role;
  const isSupervisor = role === "SUPERVISOR";

  useEffect(() => {
    if (!search) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const userBranchId = (session?.user as any)?.branchId;
        const isGlobalRole = role === "GERENTE" || role === "ADMIN";

        // Match Catalog behavior: only filter by branch if toggle is ON
        const shouldFilterByBranch = !isGlobalRole && onlyMyBranch;
        const branchParam = (shouldFilterByBranch && userBranchId) ? `&branchId=${userBranchId}` : "";
        const onlyMyBranchParam = (isSupervisor && onlyMyBranch) ? "&onlyMyBranch=true" : "";

        const res = await fetch(`/api/products?search=${search}&allStocks=true${branchParam}${onlyMyBranchParam}`);
        const data = await res.json();
        const fetchedProducts = Array.isArray(data) ? data : (data.products || []);
        setResults(fetchedProducts);
      } catch (e) {
        console.error("Error buscando productos:", e);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search, onlyMyBranch, role, isSupervisor]);

  // Capturar Enter del escáner para limpiar la búsqueda después de ver el resultado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && results.length === 1) {
      // Si solo hay uno, ya se está viendo.
    }
  };

  const handleScan = (code: string) => {
    setSearch(code);
    setShowScanner(false);
    // Play beep
    const audio = new Audio('/beep.mp3');
    audio.play().catch(e => console.log("Audio play failed", e));
  };

  // Label helper
  const isGlobalRole = role === "GERENTE" || role === "ADMIN";
  const isShowingGlobal = isGlobalRole || !onlyMyBranch;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-black mb-2 text-gray-900">Verificador de Precios</h1>
        <p className="text-gray-500 font-medium">Escanea un producto o escribe su nombre</p>
      </div>

      <div className="relative mb-10">
        <div className="absolute left-5 top-1/2 -translate-y-1/2 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
          <Search className="w-5 h-5" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Código, EAN o Nombre..."
          className="input input-lg pl-20 pr-14 text-2xl font-bold shadow-xl border-gray-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all rounded-2xl w-full"
          autoFocus
        />
        <button
          onClick={() => setShowScanner(true)}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-blue-600 hover:text-white transition-colors"
          title="Escanear con Cámara"
        >
          <ScanBarcode className="w-6 h-6" />
        </button>
      </div>

      {isSupervisor && (
        <div className="flex justify-center mb-8">
          <label className="inline-flex items-center cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={onlyMyBranch}
                onChange={() => setOnlyMyBranch(!onlyMyBranch)}
              />
              <div className={`block w-14 h-8 rounded-full transition-colors ${onlyMyBranch ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${onlyMyBranch ? 'translate-x-6' : ''}`}></div>
            </div>
            <span className="ml-3 text-sm font-bold text-gray-700 uppercase tracking-wider group-hover:text-blue-600 transition-colors">
              Filtrar por mi sucursal
            </span>
          </label>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center py-20 animate-pulse">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Buscando en el catálogo...</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className={results.length === 1 ? "max-w-lg mx-auto" : "grid grid-cols-1 md:grid-cols-2 gap-6"}>
          {results.map((product) => {
            const qty = Number(product.displayStock || 0);
            const min = Number(product.displayMinStock || 0);

            // Unified Alert Logic
            const isCritical = qty <= 0 && min > 0;
            const isLowStock = qty > 0 && qty < min;

            let stockColor = "text-green-600";
            if (isCritical) stockColor = "text-red-600";
            else if (isLowStock) stockColor = "text-orange-500";
            else if (qty <= 0) stockColor = "text-gray-400"; // 0 stock but 0 min -> neutral

            const isGlobal = (session?.user as any)?.role === "GERENTE" || (session?.user as any)?.role === "ADMIN";

            return (
              <div key={product.id} className="card bg-white border border-gray-100 shadow-xl overflow-hidden group hover:border-blue-500 transition-all duration-300 rounded-3xl p-8">
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Package className="w-10 h-10 text-blue-600" />
                  </div>
                  <p className="text-xs text-gray-400 font-mono tracking-tighter mb-1 uppercase">{product.code}</p>
                  <h2 className="text-2xl font-black text-gray-900 mb-6 min-h-[3rem] flex items-center">{product.name}</h2>

                  <div className="bg-blue-600 w-full py-6 rounded-2xl shadow-lg shadow-blue-100 mb-6">
                    <p className="text-5xl font-black text-white">${(product.displayPrice || product.basePrice)?.toLocaleString()}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 w-full">
                    <div className={`bg-gray-50 p-3 rounded-xl border border-gray-100 ${isCritical ? 'bg-red-50 border-red-100' : isLowStock ? 'bg-orange-50 border-orange-100' : ''}`}>
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-1">{isShowingGlobal ? 'Stock Global' : 'Stock Sucursal'}</p>
                      <p className={`font-bold ${stockColor}`}>
                        {qty} {product.baseUnit?.symbol || 'un'}
                      </p>
                      {min > 0 && <p className="text-[8px] font-bold text-gray-400 uppercase mt-1">Mín: {min}</p>}
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Categoría</p>
                      <p className="font-bold text-gray-700 truncate">
                        {product.category?.name || "General"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {
        !loading && search && results.length === 0 && (
          <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl py-20 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-400 font-bold">No encontramos ningún producto que coincida</p>
            <button onClick={() => setSearch("")} className="mt-4 text-blue-600 font-bold hover:underline">Limpiar búsqueda</button>
          </div>
        )
      }
      {showScanner && (
        <BarcodeScanner
          onScanSuccess={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div >
  );
}

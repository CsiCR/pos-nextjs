"use client";
import { useState, useEffect, useRef } from "react";
import { Search, Package, ScanBarcode } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useSession } from "next-auth/react";
import { formatPrice } from "@/lib/utils";
import { useSettings } from "@/hooks/use-settings";

export default function VerificadorPage() {
  const { data: session } = useSession() || {};
  const { settings } = useSettings();
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
          placeholder="EAN o Producto..."
          className="input input-lg pl-14 sm:pl-20 pr-14 text-xl sm:text-2xl font-black shadow-xl border-gray-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all rounded-2xl w-full h-16 sm:h-20"
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
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {results.map((product) => {
            const qty = Number(product.displayStock || 0);
            const min = Number(product.displayMinStock || 0);

            // Unified Alert Logic
            const isCritical = qty <= 0 && min > 0;
            const isLowStock = qty > 0 && qty < min;

            let stockColor = "text-green-600";
            if (isCritical) stockColor = "text-red-600";
            else if (isLowStock) stockColor = "text-orange-500";
            else if (qty <= 0) stockColor = "text-gray-400";

            return (
              <div key={product.id} className="card bg-white border border-gray-100 shadow-lg overflow-hidden group hover:border-blue-500 transition-all duration-200 rounded-2xl p-3 sm:p-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[8px] sm:text-[9px] text-gray-400 font-mono tracking-tighter uppercase font-bold">COD: {product.code}</p>
                    <span className="bg-gray-50 text-[8px] sm:text-[9px] font-black text-gray-400 px-1.5 py-0.5 rounded-full uppercase truncate max-w-[60px]">
                      {product.category?.name || "General"}
                    </span>
                  </div>
                  <h2 className="text-xs sm:text-sm font-black text-gray-800 mb-2 line-clamp-2 min-h-[2rem] leading-tight group-hover:text-blue-600 transition-colors uppercase">
                    {product.name}
                  </h2>
                </div>

                <div className="space-y-2">
                  <div className="bg-blue-600 w-full py-2 rounded-xl shadow-sm text-center group-hover:bg-blue-700 transition-colors">
                    <p className="text-lg sm:text-xl font-black text-white leading-none">
                      {formatPrice(product.displayPrice || product.basePrice, settings.useDecimals)}
                    </p>
                    {isShowingGlobal && <p className="text-[8px] text-blue-200 mt-1 uppercase font-bold tracking-wider">Precio Reference</p>}
                  </div>

                  {isShowingGlobal && product.stocks && product.stocks.length > 0 ? (
                    <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Por Sucursal:</p>
                      {product.stocks.map((s: any) => {
                        const branchPrice = product.prices?.find((pr: any) => pr.priceList?.branchId === s.branchId)?.price;
                        const finalPrice = branchPrice ? Number(branchPrice) : product.basePrice;
                        const sQty = Number(s.quantity);
                        const sMin = Number(s.minStock || product.minStock || 0);

                        let sColor = "text-green-600";
                        if (sQty <= 0) sColor = "text-red-500";
                        else if (sQty < sMin) sColor = "text-orange-500";

                        return (
                          <div key={s.branchId} className="flex justify-between items-center bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100">
                            <span className="text-[9px] font-bold text-gray-600 truncate max-w-[80px] sm:max-w-[100px] uppercase">{s.branch?.name || "General"}</span>
                            <div className="text-right flex items-center gap-2">
                              <span className={`text-[9px] font-black ${sColor}`}>{sQty} <span className="text-[7px]">{product.baseUnit?.symbol || 'un'}</span></span>
                              <span className="text-[10px] font-black text-blue-600 bg-white px-1.5 py-0.5 rounded border border-blue-100 shadow-sm">{formatPrice(finalPrice, settings.useDecimals)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={`p-1.5 rounded-xl border text-center ${isCritical ? 'bg-red-50 border-red-100' : isLowStock ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'}`}>
                      <div className="flex items-center justify-center gap-1">
                        <p className={`font-black text-xs sm:text-sm ${stockColor}`}>
                          {qty} <span className="text-[8px] uppercase opacity-70 font-bold">{product.baseUnit?.symbol || 'un'}</span>
                        </p>
                      </div>
                      <p className="text-[7px] sm:text-[8px] font-black text-gray-400 uppercase tracking-tighter leading-none">
                        Tu Sucursal
                      </p>
                    </div>
                  )}
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

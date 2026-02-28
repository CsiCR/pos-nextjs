"use client";
import { useState, useEffect, useRef } from "react";
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, ArrowRightLeft, ShoppingCart, AlertCircle, CheckCircle, CheckCircle2, Scale, Tag, X, Printer, MessageSquare, ScanBarcode, MapPin, User, SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Ticket } from "@/components/Ticket";
import { formatPrice, roundCurrency } from "@/lib/utils";
import { useSettings } from "@/hooks/use-settings";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { toast } from "sonner";

interface CartItem {
  productId: string;
  code: string;
  name: string;
  price: number;
  quantity: number;
  discount: number;
  unitId?: string;
  unitSymbol?: string;
  isWeighted?: boolean;
  basePrice: number;
  prices: any[];
  originBranchId?: string;
  originBranchName?: string;
}

interface PaymentDetail {
  method: string;
  amount: number;
  transactionId?: string;
}

export default function POSPage() {
  const { settings } = useSettings();
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [hasShift, setHasShift] = useState<boolean | null>(null);
  const [paymentMode, setPaymentMode] = useState<"SINGLE" | "MIXED" | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>("EFECTIVO");
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetail[]>([]);
  const [cashReceived, setCashReceived] = useState(0);
  const [actualChange, setActualChange] = useState(0);
  const [adjustment, setAdjustment] = useState(0);
  const [notes, setNotes] = useState("");
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [success, setSuccess] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [weightModal, setWeightModal] = useState<{ product: any } | null>(null);
  const [weightAmount, setWeightAmount] = useState("");
  const [priceLists, setPriceLists] = useState<any[]>([]);
  const [selectedPriceList, setSelectedPriceList] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [activeBranch, setActiveBranch] = useState<any>(null);

  // Customer State
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  const [showTicket, setShowTicket] = useState<any>(null);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/shifts/current").then(r => r.json()).then(d => {
      setHasShift(!!d?.id);
      if (d?.branch) setActiveBranch(d.branch);
    });
    fetch("/api/price-lists").then(r => r.json()).then(setPriceLists);
  }, []);

  // Customer Search
  useEffect(() => {
    if (customerSearch.length < 2) {
      setCustomerResults([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/customers?search=${customerSearch}&activeOnly=true`)
        .then(r => r.json())
        .then(setCustomerResults);
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  // Auto-select branch price list
  useEffect(() => {
    if (activeBranch && priceLists.length > 0 && !selectedPriceList) {
      const branchList = priceLists.find(l => l.branchId === activeBranch.id);
      if (branchList) {
        setSelectedPriceList(branchList.id);
      }
    }
  }, [activeBranch, priceLists, selectedPriceList]);

  useEffect(() => {
    if (!search) {
      setProducts([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/products?search=${search}${globalSearch ? '&allStocks=true' : ''}`)
        .then(r => r.json())
        .then(data => {
          const fetchedProducts = Array.isArray(data) ? data : (data.products || []);
          setProducts(fetchedProducts);
          if (fetchedProducts.length === 1 && (fetchedProducts[0].code === search || fetchedProducts[0].ean === search)) {
            addToCart(fetchedProducts[0]);
          }
        });
    }, 200);
    return () => clearTimeout(t);
  }, [search, globalSearch]);

  const handleScan = async (code: string) => {
    if (code.startsWith("SALE:")) {
      const saleId = code.replace("SALE:", "");
      const audio = new Audio('/beep.mp3');
      audio.play().catch(e => console.log("Audio play failed", e));
      setShowScanner(false);
      try {
        const res = await fetch(`/api/sales/${saleId}`);
        if (res.ok) {
          const sale = await res.json();
          setShowTicket(sale);
        } else {
          toast.error("Venta no encontrada");
        }
      } catch (error) {
        console.error("Error fetching sale via QR:", error);
      }
      return;
    }
    setSearch(code);
    setShowScanner(false);
    const audio = new Audio('/beep.mp3');
    audio.play().catch(e => console.log("Audio play failed", e));
  };

  const decimals = settings.useDecimals ? 2 : 0;
  const subtotal = cart.reduce((sum, i) => sum + roundCurrency(i.price * i.quantity, decimals), 0);
  const itemsDiscount = cart.reduce((sum, i) => sum + roundCurrency(i.discount || 0, decimals), 0);
  const total = roundCurrency(subtotal - itemsDiscount - globalDiscount, decimals);

  useEffect(() => {
    const totalPaid = paymentMode === "MIXED"
      ? paymentDetails.reduce((sum, pd) => sum + pd.amount, 0)
      : (selectedMethod === "EFECTIVO" ? cashReceived : total);
    const diff = (totalPaid - actualChange) - total;
    setAdjustment(diff);
    if (diff !== 0) {
      setNotes(`Diferencia de cambio: ${diff > 0 ? 'A favor sucursal' : 'A favor cliente'} (${Math.abs(diff).toLocaleString()})`);
    } else {
      setNotes("");
    }
  }, [actualChange, cashReceived, total, selectedMethod, paymentMode, paymentDetails]);

  const addToCart = (p: any, weight?: number, manualBranchInfo?: { id: string, name: string }) => {
    if (!hasShift) return;
    const isWeighted = p.baseUnit?.symbol === "g" || p.baseUnit?.symbol === "kg";
    if (isWeighted && !weight) {
      setWeightModal({ product: p });
      setWeightAmount("");
      return;
    }
    setCart(prev => {
      const targetBranchId = manualBranchInfo?.id || p.branchId || activeBranch?.id;
      const exists = prev.find(i => i.productId === p.id && i.originBranchId === targetBranchId);
      const qty = weight || 1;
      let price = Number(p.displayPrice || p.basePrice || 0);
      if (selectedPriceList) {
        const listPrice = p.prices?.find((lp: any) => lp.priceListId === selectedPriceList);
        if (listPrice) price = Number(listPrice.price);
      }
      if (exists && !isWeighted) {
        return prev.map(i => (i.productId === p.id && i.originBranchId === targetBranchId) ? { ...i, quantity: i.quantity + qty } : i);
      }
      return [...prev, {
        productId: p.id,
        code: p.code,
        name: p.name,
        price,
        quantity: qty,
        discount: 0,
        unitId: p.baseUnitId,
        unitSymbol: p.baseUnit?.symbol,
        isWeighted,
        basePrice: Number(p.basePrice || 0),
        prices: p.prices || [],
        originBranchId: targetBranchId,
        originBranchName: manualBranchInfo?.name || p.branch?.name || activeBranch?.name
      }];
    });
    setSearch("");
    setWeightModal(null);
    searchRef.current?.focus();
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => i.productId === id ? { ...i, quantity: Math.max(0.001, i.quantity + delta) } : i));
  };
  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.productId !== id));
  const clearCart = () => setCart([]);

  const handlePriceListChange = (listId: string | null) => {
    setSelectedPriceList(listId);
    setCart(prev => prev.map(item => {
      let newPrice = item.basePrice;
      if (listId) {
        const lp = item.prices.find((p: any) => p.priceListId === listId);
        if (lp) newPrice = lp.price;
      }
      return { ...item, price: newPrice };
    }));
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && products.length > 0) {
      const exactMatch = products.find(p => p.code === search || p.ean === search);
      if (exactMatch) addToCart(exactMatch);
      else if (products.length === 1) addToCart(products[0]);
    }
  };

  const handlePayment = async () => {
    setLoading(true);
    const body = {
      items: cart.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        price: i.price,
        unitId: i.unitId,
        originBranchId: i.originBranchId
      })),
      paymentMethod: selectedMethod,
      cashReceived: (selectedMethod === "EFECTIVO" || (selectedMethod === "MIXTO" && paymentDetails.some(pd => pd.method === "EFECTIVO"))) ? cashReceived : null,
      discount: globalDiscount,
      adjustment,
      notes,
      priceListId: selectedPriceList,
      customerId: selectedCustomer?.id,
      paymentDetails: selectedMethod === "MIXTO" ? paymentDetails : []
    };

    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      const detailRes = await fetch(`/api/sales/${data.id}`);
      const fullSale = detailRes.ok ? await detailRes.json() : data;
      setSuccess(fullSale);
      setShowTicket(fullSale);
      setCart([]);
      setPaymentMode(null);
      setPaymentDetails([]);
      setSelectedCustomer(null);
      setCashReceived(0);
      setActualChange(0);
      setAdjustment(0);
      setGlobalDiscount(0);
    } else {
      toast.error(data.error);
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
      <>
        <div className="card text-center py-16 max-w-lg mx-auto">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">¡Venta Exitosa!</h2>
          <p className="text-4xl font-bold text-green-600 mb-6">{formatPrice(success.total, settings.useDecimals)}</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => setShowTicket(success)} className="btn bg-blue-50 text-blue-600 border-none hover:bg-blue-100 py-4 font-bold flex items-center justify-center gap-2">
              <Printer className="w-5 h-5" /> Ver e Imprimir Ticket
            </button>
            <button onClick={() => { setSuccess(null); setShowTicket(null); setCart([]); setProducts([]); setSearch(""); setPaymentMode(null); setPaymentDetails([]); setCashReceived(0); setActualChange(0); setAdjustment(0); setGlobalDiscount(0); searchRef.current?.focus(); }} className="btn btn-primary btn-lg">
              Nueva Venta
            </button>
          </div>
        </div>
        {showTicket && <Ticket sale={showTicket} onClose={() => setShowTicket(null)} />}
      </>
    );
  }

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 h-[calc(100vh-80px)] lg:h-[calc(100vh-120px)] relative">
      {/* Products Area */}
      <div className="lg:col-span-2 flex flex-col min-h-0">
        <div className="bg-white p-4 rounded-xl border border-gray-100 mb-4 shadow-sm">
          {/* Customer Selection */}
          <div className="mb-4 relative">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-blue-500" />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cliente / Cuenta Corriente</span>
            </div>
            <div className="flex gap-2">
              {selectedCustomer ? (
                <div className="flex-1 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2 flex items-center justify-between animate-in fade-in slide-in-from-top-1">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                      {selectedCustomer.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-black text-blue-900">{selectedCustomer.name}</p>
                      <p className="text-[10px] text-blue-400 font-bold">Saldo: {formatPrice(selectedCustomer.balance, settings.useDecimals)}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedCustomer(null)} className="p-1 hover:bg-blue-100 rounded-full text-blue-600 transition">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="relative flex-1">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar cliente por nombre o documento..."
                    value={customerSearch}
                    onChange={e => { setCustomerSearch(e.target.value); setShowCustomerSearch(true); }}
                    className="input pl-10 h-11 text-sm border-gray-200 bg-gray-50/50"
                  />
                  {showCustomerSearch && customerResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                      {customerResults.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); setShowCustomerSearch(false); }}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 border-b last:border-0 transition"
                        >
                          <div className="text-left">
                            <p className="font-bold text-gray-800 text-sm">{c.name}</p>
                            <p className="text-[10px] text-gray-400">{c.document || "Sin documento"}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-black ${Number(c.balance) > 0 ? "text-red-500" : "text-green-500"}`}>
                              {formatPrice(c.balance, settings.useDecimals)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button onClick={() => router.push("/clientes")} className="btn bg-gray-50 border-gray-200 hover:bg-white text-gray-500 p-3 rounded-xl" title="Gestionar Clientes">
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-2 mb-4">
            <div className="relative group flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Escanea el código o busca productos..."
                className="input pl-14 h-14 text-lg w-full bg-white border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                autoFocus
              />
              <button onClick={() => setShowScanner(true)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-blue-600 rounded-lg transition"><ScanBarcode className="w-5 h-5" /></button>
            </div>
            <label className="flex items-center gap-2 cursor-pointer bg-gray-50 border px-4 h-14 rounded-xl hover:bg-white transition-all group">
              <input type="checkbox" checked={globalSearch} onChange={e => setGlobalSearch(e.target.checked)} className="checkbox checkbox-primary checkbox-sm" />
              <span className={`text-[10px] font-bold transition-colors ${globalSearch ? 'text-blue-600' : 'text-gray-400'}`}>BUSQUEDA GLOBAL</span>
            </label>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 md:flex-none">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <select value={selectedPriceList || ""} onChange={e => handlePriceListChange(e.target.value || null)} className="input pl-9 pr-8 h-12 text-xs font-bold appearance-none bg-white border-gray-200 focus:border-blue-500 w-full md:min-w-[140px]">
                <option value="">General (Base)</option>
                {priceLists.map(l => (<option key={l.id} value={l.id}>{l.name}</option>))}
              </select>
            </div>
            <button onClick={clearCart} className="btn btn-outline border-red-200 text-red-500 hover:bg-red-50 p-3 rounded-xl"><Trash2 className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto grid grid-cols-2 md:grid-cols-3 gap-3">
          {products.map(p => (
            <button key={p.id} onClick={() => addToCart(p)} className="card hover:shadow-lg transition-all text-left bg-white border border-gray-100 p-4 rounded-2xl group">
              <div className="flex justify-between items-start mb-1"><span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono uppercase">{p.code}</span></div>
              <p className="font-semibold text-gray-800 line-clamp-2 min-h-[2.5rem] text-sm">{p.name}</p>
              <div className="flex justify-between items-end mt-auto">
                <p className="text-xl font-black text-blue-600">{formatPrice(p.displayPrice || p.basePrice, settings.useDecimals)}</p>
                <span className="text-[10px] text-gray-400">{p.baseUnit?.symbol}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart & Checkout */}
      <div className={`flex flex-col h-full bg-white shadow-xl border-t-4 border-blue-600 ${showMobileCart ? 'fixed inset-0 z-50' : 'hidden lg:flex'} lg:relative lg:col-span-1 lg:rounded-xl`}>
        <div className="p-4 border-b bg-gray-50/50 flex items-center justify-between">
          <h2 className="font-bold flex items-center gap-2 text-gray-800"><ShoppingCart className="w-5 h-5 text-blue-600" /> Carrito ({cart.length})</h2>
          <button onClick={() => setShowMobileCart(false)} className="lg:hidden p-2"><X className="w-6 h-6" /></button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-2">
          {cart.map(item => (
            <div key={`${item.productId}-${item.originBranchId}`} className="bg-gray-50 rounded-xl p-3 border border-gray-100 transition shadow-sm">
              <div className="flex justify-between items-start mb-2"><p className="font-bold text-gray-900 truncate text-xs">{item.name}</p><button onClick={() => removeItem(item.productId)} className="text-gray-300 hover:text-red-500"><X className="w-4 h-4" /></button></div>
              <div className="flex items-center justify-between">
                <div className="flex items-center bg-white rounded-lg border p-0.5"><button onClick={() => updateQty(item.productId, -1)} className="w-7 h-7 flex items-center justify-center text-gray-500"><Minus className="w-3 h-3" /></button><span className="w-10 text-center font-bold text-xs">{item.quantity}</span><button onClick={() => updateQty(item.productId, 1)} className="w-7 h-7 flex items-center justify-center text-gray-500"><Plus className="w-3 h-3" /></button></div>
                <p className="font-black text-sm text-gray-900">{formatPrice(item.price * item.quantity, settings.useDecimals)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t bg-white space-y-3">
          <div className="flex justify-between text-sm text-gray-500"><span>Subtotal:</span><span>{formatPrice(subtotal, settings.useDecimals)}</span></div>
          <div className="flex justify-between items-center bg-blue-50 -mx-4 px-4 py-3"><span className="text-lg font-bold">TOTAL:</span><span className="text-2xl font-black text-blue-600">${total.toLocaleString()}</span></div>
          {!paymentMode ? (
            <button onClick={() => { setPaymentMode("SINGLE"); setSelectedMethod("EFECTIVO"); setCashReceived(total); }} disabled={!cart.length} className="btn btn-primary w-full btn-lg font-black h-14">COBRAR</button>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-1">
                {["EFECTIVO", "DEBITO", "CREDITO", "QR", "TRANSFERENCIA", "CUENTA_CORRIENTE", "MIXTO"]
                  .filter(m => m !== "CUENTA_CORRIENTE" || settings.enableCustomerAccounts)
                  .map(m => (
                    <button
                      key={m}
                      onClick={() => {
                        setSelectedMethod(m);
                        if (m === "MIXTO") { setPaymentMode("MIXED"); setPaymentDetails([]); }
                        else { setPaymentMode("SINGLE"); setCashReceived(m === "EFECTIVO" ? total : 0); }
                      }}
                      className={`p-2 text-[9px] font-black rounded-lg border truncate ${selectedMethod === m ? "bg-blue-600 border-blue-600 text-white" : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-white"}`}
                    >
                      {m === "CUENTA_CORRIENTE" ? "CTA. CTE" : m}
                    </button>
                  ))}
              </div>
              {selectedMethod === "EFECTIVO" && (
                <div className="bg-gray-50 p-4 rounded-2xl border space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase">Recibido:</label>
                  <input type="number" value={cashReceived || ""} onChange={e => { const v = Number(e.target.value); setCashReceived(v); setActualChange(Math.max(0, v - total)); }} className="input input-lg text-right font-black text-2xl" autoFocus onFocus={e => e.target.select()} />
                  <div className="flex justify-between items-center text-green-600 pt-2 border-t font-black underline decoration-green-200 decoration-2"><span>Vuelto:</span><span className="text-2xl">${actualChange.toLocaleString()}</span></div>
                </div>
              )}
              {selectedMethod === "CUENTA_CORRIENTE" && !selectedCustomer && (
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-center gap-3 text-red-600 animate-pulse">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-xs font-bold leading-tight uppercase">Debes seleccionar un cliente para vender en Cuenta Corriente</p>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setPaymentMode(null)} className="btn bg-gray-100 flex-1">Volver</button>
                <button onClick={handlePayment} disabled={loading || (selectedMethod === "EFECTIVO" && cashReceived <= 0) || (selectedMethod === "CUENTA_CORRIENTE" && !selectedCustomer)} className="btn btn-success flex-1 font-black">CONFIRMAR</button>
              </div>
            </div>
          )}
        </div>
      </div>
      {showTicket && <Ticket sale={showTicket} onClose={() => setShowTicket(null)} />}
    </div>
  );
}

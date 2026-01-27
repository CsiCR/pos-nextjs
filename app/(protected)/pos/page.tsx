"use client";
import { useState, useEffect, useRef } from "react";
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, ArrowRightLeft, ShoppingCart, AlertCircle, CheckCircle, Scale, Tag, X, Printer, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { Ticket } from "@/components/Ticket";
import { formatPrice, roundCurrency } from "@/lib/utils";
import { useSettings } from "@/hooks/use-settings";

// ... interfaces ...

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
  const [showTicket, setShowTicket] = useState<any>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/shifts/current").then(r => r.json()).then(d => setHasShift(!!d?.id));
    fetch("/api/price-lists").then(r => r.json()).then(setPriceLists);
  }, []);

  useEffect(() => {
    if (!search) {
      setProducts([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/products?search=${search}`)
        .then(r => r.json())
        .then(data => {
          setProducts(data);
          // Auto-add on exact match (typical for barcode scanners)
          if (data.length === 1 && (data[0].code === search || data[0].ean === search)) {
            addToCart(data[0]);
          }
        });
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  const decimals = settings.useDecimals ? 2 : 0;

  const subtotal = cart.reduce((sum, i) => sum + roundCurrency(i.price * i.quantity, decimals), 0);
  const itemsDiscount = cart.reduce((sum, i) => sum + roundCurrency(i.discount || 0, decimals), 0);
  const total = roundCurrency(subtotal - itemsDiscount - globalDiscount, decimals);

  // Synchronize adjustment
  useEffect(() => {
    const totalPaid = paymentMode === "MIXED"
      ? paymentDetails.reduce((sum, pd) => sum + pd.amount, 0)
      : (selectedMethod === "EFECTIVO" ? cashReceived : total);

    // Adjustment: What we actually have (Paid minus Change) vs What we should have (Total)
    // Positive means shop got more money than expected.
    const diff = (totalPaid - actualChange) - total;
    setAdjustment(diff);

    if (diff !== 0) {
      setNotes(`Diferencia de cambio: ${diff > 0 ? 'A favor sucursal' : 'A favor cliente'} (${Math.abs(diff).toLocaleString()})`);
    } else {
      setNotes("");
    }
  }, [actualChange, cashReceived, total, selectedMethod, paymentMode, paymentDetails]);

  const addToCart = (p: any, weight?: number) => {
    const isWeighted = p.baseUnit?.symbol === "g" || p.baseUnit?.symbol === "kg";
    if (isWeighted && !weight) {
      setWeightModal({ product: p });
      setWeightAmount("");
      return;
    }

    setCart(prev => {
      const exists = prev.find(i => i.productId === p.id);
      const qty = weight || 1;

      // Get price based on selected list
      let price = Number(p.basePrice || 0);
      if (selectedPriceList) {
        const listPrice = p.prices?.find((lp: any) => lp.priceListId === selectedPriceList);
        if (listPrice) price = Number(listPrice.price);
      }

      if (exists && !isWeighted) {
        return prev.map(i => i.productId === p.id ? { ...i, quantity: i.quantity + qty } : i);
      }
      return [...prev, {
        productId: p.id,
        code: p.code,
        name: p.name,
        price,
        quantity: qty,
        discount: 0,
        unitId: p.baseUnitId, // Fix: Use correct field access
        unitSymbol: p.baseUnit?.symbol,
        isWeighted,
        basePrice: Number(p.basePrice || 0),
        prices: p.prices || []
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
      // If there's an exact match in the results or just one result, add it
      const exactMatch = products.find(p => p.code === search || p.ean === search);
      if (exactMatch) {
        addToCart(exactMatch);
      } else if (products.length === 1) {
        addToCart(products[0]);
      }
    }
  };

  const handlePayment = async () => {
    setLoading(true);
    const cashInMixed = paymentDetails
      .filter(pd => pd.method === "EFECTIVO")
      .reduce((sum, pd) => sum + pd.amount, 0);

    const body = {
      items: cart.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        price: i.price,
        unitId: i.unitId
      })),
      paymentMethod: paymentMode === "MIXED" ? "MIXTO" : selectedMethod,
      cashReceived: paymentMode === "MIXED" ? cashInMixed : (selectedMethod === "EFECTIVO" ? cashReceived : null),
      paymentDetails: paymentMode === "MIXED" ? paymentDetails : [{ method: selectedMethod, amount: total }],
      discount: globalDiscount,
      adjustment,
      notes,
      priceListId: selectedPriceList
    };

    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setSuccess({ ...data, change: actualChange });
      setCart([]);
      setPaymentMode(null);
      setPaymentDetails([]);
      setCashReceived(0);
      setActualChange(0);
      setAdjustment(0);
      setNotes("");
      setGlobalDiscount(0);

      // Fetch full sale detail for the ticket
      const detailRes = await fetch(`/api/sales/${data.id}`);
      if (detailRes.ok) {
        const fullSale = await detailRes.json();
        setSuccess(fullSale);
        setShowTicket(fullSale);
      } else {
        setSuccess(data);
      }
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
      <>
        <div className="card text-center py-16 max-w-lg mx-auto">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">¡Venta Exitosa!</h2>
          <p className="text-4xl font-bold text-green-600 mb-6">{formatPrice(success.total, settings.useDecimals)}</p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => setShowTicket(success)}
              className="btn bg-blue-50 text-blue-600 border-none hover:bg-blue-100 py-4 font-bold flex items-center justify-center gap-2"
            >
              <Printer className="w-5 h-5" /> Ver e Imprimir Ticket
            </button>
            <button
              onClick={() => {
                setSuccess(null);
                setShowTicket(null);
                setCart([]); // Ensure cart is cleared
                setProducts([]); // Clear search results
                setSearch(""); // Clear search term
                setPaymentMode(null);
                setPaymentDetails([]);
                setCashReceived(0);
                setActualChange(0);
                setAdjustment(0);
                setNotes("");
                setGlobalDiscount(0);
                searchRef.current?.focus();
              }}
              className="btn btn-primary btn-lg"
            >
              Nueva Venta
            </button>
          </div>
        </div>

        {showTicket && (
          <Ticket
            sale={showTicket}
            onClose={() => setShowTicket(null)}
          />
        )}
      </>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4 h-[calc(100vh-120px)]">
      {/* Products Area */}
      <div className="lg:col-span-2 flex flex-col min-h-0">
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Escanear código o escribir nombre..."
              className="input input-lg pl-14 shadow-sm"
              autoFocus
            />
          </div>

          {/* Price List Selector */}
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select
              value={selectedPriceList || ""}
              onChange={e => handlePriceListChange(e.target.value || null)}
              className="input pl-9 pr-8 py-2 h-full text-xs font-bold appearance-none bg-white border-gray-200 focus:border-blue-500 min-w-[140px]"
            >
              <option value="">General (Base)</option>
              {priceLists.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <button onClick={clearCart} className="btn btn-outline border-red-200 text-red-500 hover:bg-red-50 shrink-0" title="Vaciar Carrito">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto grid grid-cols-2 md:grid-cols-3 gap-3 pr-2">
          {products.length === 0 && search && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
              <Search className="w-12 h-12 mb-2 opacity-20" />
              <p className="font-medium">No se encontraron productos</p>
            </div>
          )}
          {(products ?? []).slice(0, 15).map(p => {
            const currentStock = p.stocks?.[0]?.quantity || 0;
            let displayPrice = p.basePrice;
            if (selectedPriceList) {
              const lp = p.prices?.find((lp: any) => lp.priceListId === selectedPriceList);
              if (lp) displayPrice = lp.price;
            }

            return (
              <button key={p.id} onClick={() => addToCart(p)} className="card hover:shadow-lg transition-all text-left group border-transparent hover:border-blue-200">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono uppercase">{p.code}</span>
                  {Number(currentStock) <= 0 ? (
                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">AGOTADO</span>
                  ) : Number(currentStock) < Number(p.minStock || 0) && (
                    <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold">STOCK BAJO</span>
                  )}
                </div>
                <p className="font-semibold text-gray-800 line-clamp-2 min-h-[3rem]">{p.name}</p>
                <div className="flex justify-between items-end mt-auto">
                  <p className="text-2xl font-black text-blue-600">{formatPrice(displayPrice, settings.useDecimals)}</p>
                  <span className="text-xs text-gray-400">{p.baseUnit?.symbol}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cart & Checkout Area */}
      <div className="card flex flex-col h-full bg-white shadow-xl border-t-4 border-blue-600">
        <div className="flex items-center justify-between mb-4 pb-2 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="font-bold text-gray-800">Carrito ({cart.length})</h2>
          </div>
          <Tag className="w-4 h-4 text-gray-300" />
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-auto space-y-2 pr-1 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <ShoppingCart className="w-12 h-12 mb-2 opacity-20" />
              <p>El carrito está vacío</p>
            </div>
          ) : cart.map(item => (
            <div key={item.productId} className="bg-gray-50 rounded-xl p-3 border border-gray-100 hover:border-blue-100 transition shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div className="min-w-0 pr-2">
                  <p className="font-bold text-gray-900 truncate text-sm">{item.name}</p>
                  <p className="text-[10px] text-gray-500">{formatPrice(item.price, settings.useDecimals)} / {item.unitSymbol}</p>
                </div>
                <button onClick={() => removeItem(item.productId)} className="text-gray-300 hover:text-red-500 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center bg-white rounded-lg border p-0.5 shadow-inner">
                  <button onClick={() => updateQty(item.productId, -1)} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-blue-600"><Minus className="w-4 h-4" /></button>
                  <input
                    type="number"
                    step="0.001"
                    value={item.quantity}
                    onChange={e => updateQty(item.productId, Number(e.target.value) - item.quantity)}
                    className="w-16 text-center font-bold text-sm bg-transparent border-none focus:ring-0 p-0"
                  />
                  <button onClick={() => updateQty(item.productId, 1)} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-blue-600"><Plus className="w-4 h-4" /></button>
                </div>
                <p className="font-black text-gray-900 text-lg">{formatPrice(item.price * item.quantity, settings.useDecimals)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Totals Area */}
        <div className="border-t pt-4 mt-4 space-y-3 px-1">
          <div className="flex justify-between items-center text-gray-500 text-sm">
            <span>Subtotal:</span>
            <span>{formatPrice(subtotal, settings.useDecimals)}</span>
          </div>

          <div className="flex justify-between items-center text-gray-500 text-sm">
            <div className="flex items-center gap-2">
              <span>Descuento:</span>
              <input
                type="number"
                value={globalDiscount || ""}
                onChange={e => setGlobalDiscount(Number(e.target.value))}
                disabled={!!paymentMode}
                className={`w-20 px-2 py-0.5 text-right border rounded text-xs ${paymentMode ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-gray-50 text-gray-900"}`}
                placeholder="0"
              />
            </div>
            <span className="text-red-500">-${globalDiscount.toLocaleString()}</span>
          </div>

          <div className="flex justify-between items-center py-2 border-y bg-blue-50/50 -mx-5 px-5">
            <span className="text-xl font-bold text-gray-800">TOTAL:</span>
            <span className="text-3xl font-black text-blue-600">${total.toLocaleString()}</span>
          </div>

          {/* Payment Methods */}
          {!paymentMode ? (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => {
                  setPaymentMode("SINGLE");
                  setSelectedMethod("EFECTIVO");
                  setCashReceived(total); // Auto-suggest total
                }}
                disabled={!cart.length}
                className="btn btn-primary btn-lg shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
              >
                <Banknote className="w-5 h-5" /> Cobrar
              </button>
              <button
                onClick={() => {
                  setPaymentMode("MIXED");
                  setPaymentDetails([]);
                }}
                disabled={!cart.length}
                className="btn btn-outline border-blue-200 text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-2"
              >
                <ArrowRightLeft className="w-5 h-5" /> Mixto
              </button>
            </div>
          ) : paymentMode === "SINGLE" ? (
            <div className="space-y-4">
              <div className="flex gap-1">
                {["EFECTIVO", "DEBITO", "CREDITO", "TRANSFERENCIA"].map(m => (
                  <button
                    key={m}
                    onClick={() => {
                      setSelectedMethod(m);
                      setCashReceived(m === "EFECTIVO" ? total : 0);
                    }}
                    className={`flex-1 py-2 text-[10px] font-bold rounded-lg border transition ${selectedMethod === m ? "bg-blue-600 border-blue-600 text-white" : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-white"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {selectedMethod === "EFECTIVO" ? (
                <div className="bg-gray-50 p-4 rounded-xl space-y-3 border">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recibido (Efectivo):</label>
                  <input
                    type="number"
                    value={cashReceived || ""}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setCashReceived(val);
                      setActualChange(Math.max(0, val - total)); // Update suggested change
                    }}
                    placeholder="Monto entregado"
                    className="input input-lg text-center font-black text-2xl text-blue-600"
                    autoFocus
                    onFocus={(e) => e.target.select()}
                  />
                  <div className="flex justify-between items-center text-green-600 font-bold px-2 pt-2 border-t">
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-wider">Vuelto:</span>
                      {adjustment !== 0 && (
                        <span className={`text-sm font-bold italic ${adjustment > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                          Ajuste: ${adjustment.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      value={actualChange || ""}
                      onFocus={(e) => e.target.select()}
                      onChange={e => setActualChange(Number(e.target.value))}
                      className="w-32 text-right font-black text-2xl bg-transparent border-b-2 border-green-200 focus:border-green-500 focus:ring-0"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded-xl text-center border">
                  <p className="text-gray-500 font-medium italic">Confirma para completar el pago con {selectedMethod}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPaymentMode(null)} className="btn bg-gray-100 hover:bg-gray-200 text-gray-600">Volver</button>
                <button
                  onClick={handlePayment}
                  disabled={loading || (selectedMethod === "EFECTIVO" && cashReceived <= 0)}
                  className="btn btn-success shadow-lg shadow-green-100 font-bold"
                >
                  {loading ? "Procesando..." : "Confirmar"}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 p-3 rounded-xl border space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-xs font-bold text-gray-500 uppercase">Pagos Mixtos</p>
                <div className="flex gap-2">
                  <button onClick={() => setPaymentDetails([])} className="text-[10px] text-red-500 hover:underline">Limpiar</button>
                  <button onClick={() => setPaymentMode(null)} className="text-[10px] text-blue-600 hover:underline">Cancelar</button>
                </div>
              </div>

              {/* Payment entries list */}
              <div className="space-y-1 max-h-32 overflow-auto">
                {paymentDetails.map((pd, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border text-sm">
                    <span className="font-bold">{pd.method}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">${pd.amount.toLocaleString()}</span>
                      <button
                        onClick={() => setPaymentDetails(prev => prev.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Payment Entry */}
              {(() => {
                const paid = paymentDetails.reduce((sum, p) => sum + p.amount, 0);
                const remaining = total - paid;
                if (remaining <= 0) return null;

                return (
                  <div className="space-y-2 border-t pt-2">
                    <p className="text-[10px] font-bold text-blue-600">Restante: ${remaining.toLocaleString()}</p>
                    <div className="grid grid-cols-2 gap-1">
                      <select
                        id="mixedMethod"
                        className="select select-sm text-xs"
                        defaultValue="EFECTIVO"
                      >
                        <option value="EFECTIVO">Efectivo</option>
                        <option value="DEBITO">Débito</option>
                        <option value="CREDITO">Crédito</option>
                        <option value="TRANSFERENCIA">Transf.</option>
                      </select>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          id="mixedAmount"
                          placeholder="Monto"
                          className="input input-sm w-full text-right"
                          key={`rem-${remaining}`} // Force re-render with new default
                          defaultValue={remaining}
                        />
                        <button
                          onClick={() => {
                            const m = (document.getElementById("mixedMethod") as HTMLSelectElement).value;
                            const a = Number((document.getElementById("mixedAmount") as HTMLInputElement).value);
                            if (a > 0) setPaymentDetails(prev => [...prev, { method: m, amount: a }]);
                          }}
                          className="btn btn-sm btn-primary"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="border-t pt-2 space-y-2">
                <div className="flex justify-between text-sm font-bold">
                  <span>Total Pagado:</span>
                  <span className={paymentDetails.reduce((sum, p) => sum + p.amount, 0) >= total ? "text-green-600" : "text-red-600"}>
                    ${paymentDetails.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                  </span>
                </div>

                {/* Vuelto section for Mixed payments if cash was involved */}
                {paymentDetails.some(pd => pd.method === "EFECTIVO") && (
                  <div className="bg-green-50/50 p-3 rounded-lg border border-green-100 flex justify-between items-center text-green-900 mt-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-wider">Vuelto (Efectivo):</span>
                      {adjustment !== 0 && (
                        <span className={`text-[9px] italic ${adjustment > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                          Ajuste: ${adjustment.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      value={actualChange || ""}
                      onFocus={(e) => e.target.select()}
                      onChange={e => setActualChange(Number(e.target.value))}
                      className="w-24 text-right font-black text-xl bg-transparent border-b-2 border-green-200 focus:border-green-500 focus:ring-0"
                    />
                  </div>
                )}

                <button
                  onClick={handlePayment}
                  disabled={loading || paymentDetails.reduce((sum, p) => sum + p.amount, 0) < total}
                  className="btn btn-success w-full font-bold mt-2"
                >
                  {loading ? "Procesando..." : "Finalizar Venta Mixta"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Weight Modal */}
      {weightModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-200">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Scale className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-center mb-1">{weightModal.product.name}</h3>
            <p className="text-gray-500 text-center mb-6">Indica la cantidad en <strong>Gramos</strong></p>

            <input
              type="number"
              value={weightAmount}
              onChange={e => setWeightAmount(e.target.value)}
              placeholder="Ej: 500"
              className="input input-lg text-center font-black text-3xl mb-6"
              autoFocus
            />

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setWeightModal(null)} className="btn btn-secondary btn-lg">Cancelar</button>
              <button
                onClick={() => addToCart(weightModal.product, Number(weightAmount))}
                disabled={!weightAmount}
                className="btn btn-primary btn-lg"
              >
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

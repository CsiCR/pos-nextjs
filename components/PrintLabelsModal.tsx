"use client";
import { useState } from "react";
import { X, Printer, LayoutGrid, Type, Maximize2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface PrintLabelsModalProps {
    ids: string[];
    products: any[];
    onClose: () => void;
    settings: any;
}

export function PrintLabelsModal({ ids, products, onClose, settings }: PrintLabelsModalProps) {
    const selectedProducts = products.filter(p => ids.includes(p.id));
    const [layout, setLayout] = useState<"3x8" | "2x5" | "1x1">("3x8");
    const [fontSize, setFontSize] = useState(24);
    const [showInternalCode, setShowInternalCode] = useState(false);

    const print = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const cols = layout === "3x8" ? 3 : layout === "2x5" ? 2 : 1;
        const rows = layout === "3x8" ? 8 : layout === "2x5" ? 5 : 1;

        const labelsHtml = selectedProducts.map(p => `
      <div class="label">
        <div class="name">${p.name}</div>
        <div class="price" style="font-size: ${fontSize}px">$${(p.basePrice || 0).toLocaleString()}</div>
        <div class="barcode">${p.ean || p.code}</div>
        <div class="code-text">${p.ean || p.code}</div>
      </div>
    `).join('');

        printWindow.document.write(`
      <html>
        <head>
          <title>Etiquetas de Góndola</title>
          <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Inter', sans-serif; 
              margin: 10mm;
              display: grid;
              grid-template-columns: repeat(${cols}, 1fr);
              gap: 2mm;
            }
            .label {
              border: 0.1mm solid #eee;
              padding: 5mm;
              text-align: center;
              height: ${297 / rows - 15}mm; /* Dynamic height based on standard A4 */
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              overflow: hidden;
              box-sizing: border-box;
            }
            .name { 
              font-weight: 700; 
              font-size: 10pt; 
              margin-bottom: 2mm;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
            .price { 
              font-weight: 900; 
              color: black;
              margin-bottom: 2mm;
              font-size: ${fontSize}px; /* Added missing sync */
            }
            .barcode {
              font-family: 'Libre Barcode 128', cursive;
              font-size: 32pt;
              line-height: 1;
              margin: 1mm 0;
            }
            .code-text {
              font-family: monospace;
              font-size: 7pt;
              letter-spacing: 1mm;
            }
            @media print {
              .label { border-color: transparent; }
              body { margin: 10mm; }
            }
          </style>
        </head>
        <body>
          ${labelsHtml}
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 500);
          </script>
        </body>
      </html>
    `);
        printWindow.document.close();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Printer className="w-6 h-6 text-blue-600" />
                        </div>
                        Configurar Impresión de Etiquetas
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                    <div className="space-y-6">
                        <div>
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 block flex items-center gap-2">
                                <LayoutGrid className="w-3 h-3" /> Diseño de Página (A4)
                            </label>
                            <div className="grid grid-cols-1 gap-2">
                                {[
                                    { id: "3x8", label: "Pequeño (3x8)", desc: "24 etiquetas por hoja" },
                                    { id: "2x5", label: "Grande (2x5)", desc: "10 etiquetas por hoja" },
                                    { id: "1x1", label: "Individual", desc: "1 por fila" }
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setLayout(opt.id as any)}
                                        className={`p-4 rounded-2xl border text-left transition-all ${layout === opt.id ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-50' : 'border-gray-100 hover:border-blue-200'}`}
                                    >
                                        <p className={`font-bold ${layout === opt.id ? 'text-blue-600' : 'text-gray-900'}`}>{opt.label}</p>
                                        <p className="text-xs text-gray-400">{opt.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 block flex items-center gap-2">
                                <Type className="w-3 h-3" /> Tamaño del Precio
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min="16" max="48"
                                    value={fontSize}
                                    onChange={e => setFontSize(parseInt(e.target.value))}
                                    className="w-full"
                                />
                                <span className="font-bold text-blue-600 w-12">{fontSize}px</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 block flex items-center gap-2">
                            <Maximize2 className="w-3 h-3" /> Vista Previa
                        </label>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center space-y-2 aspect-[3/4] flex flex-col justify-center overflow-hidden">
                            <p className="font-bold text-gray-900 text-sm line-clamp-2">{selectedProducts[0]?.name || "Nombre del Producto"}</p>
                            <p className="font-black text-black" style={{ fontSize: `${fontSize / 2}px` }}>
                                ${(selectedProducts[0]?.basePrice || 0).toLocaleString()}
                            </p>
                            <div className="text-[24px] font-['Libre_Barcode_128'] text-gray-400">12345678</div>
                            <p className="text-[8px] font-mono text-gray-400 tracking-widest">12345678</p>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-4 text-center italic">Mostrando primer producto como referencia</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button onClick={onClose} className="btn bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-4">
                        Cancelar
                    </button>
                    <button onClick={print} className="btn btn-primary shadow-xl shadow-blue-100 font-bold py-4 flex items-center justify-center gap-2">
                        <Printer className="w-5 h-5" /> Imprimir {selectedProducts.length} Etiquetas
                    </button>
                </div>
            </div>
        </div>
    );
}

import { createWorker } from 'tesseract.js';

export interface OCRResult {
    supplierName?: string;
    invoiceNumber?: string;
    totalAmount?: number;
    date?: string;
    items: Array<{
        name: string;
        quantity: number;
        costPrice: number;
    }>;
}

/**
 * Procesa una imagen y extrae datos de facturas argentinas (especialmente tickets)
 */
export async function processInvoiceImage(file: File): Promise<OCRResult | null> {
    const worker = await createWorker('spa'); // Usamos español

    try {
        const imageUrl = URL.createObjectURL(file);
        const { data: { text } } = await worker.recognize(imageUrl);
        console.log("OCR Raw Text:", text);

        const result = parseArgentineInvoice(text);
        URL.revokeObjectURL(imageUrl);
        return result;
    } catch (error) {
        console.error("OCR Error:", error);
        return null;
    } finally {
        await worker.terminate();
    }
}

function parseArgentineInvoice(text: string): OCRResult {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const result: OCRResult = { items: [] };

    // 1. Proveedor (Primera línea significativa suele ser el nombre)
    if (lines.length > 0) {
        // A veces la primera linea es basura o el logo, buscamos algo que parezca nombre
        result.supplierName = lines[0].toUpperCase();
    }

    // 2. Número de Factura
    // Buscamos patrones como "Nro. T. 00150329" o "Factura Nro" o "00009"
    const invoiceMatch = text.match(/(?:Nro|Num|Numero|Nro\.\s*T\.|P\.V\.\s*Nro\.)\s*[:\.]?\s*(\d+[-\d]*)/i);
    if (invoiceMatch) {
        result.invoiceNumber = invoiceMatch[1];
    }

    // 3. Total
    // Buscamos "TOTAL" seguido de un número, manejando posibles decimales con coma
    const totalMatch = text.match(/TOTAL\s*[:\s]*\$?\s*(\d+(?:[\.,]\d{2})?)/i);
    if (totalMatch) {
        result.totalAmount = parseFloat(totalMatch[1].replace(',', '.'));
    }

    // 4. Fecha
    const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (dateMatch) {
        result.date = dateMatch[1];
    }

    // 5. Items (Líneas que parecen "Cantidad x Precio" o "Desc ... Precio")
    // Ejemplo: "4 x 2200,00" seguido por el nombre en la siguiente linea o misma
    // O "Nombre ... 8800,00"

    lines.forEach((line, index) => {
        // 1. Patrón Columna Formal Mejorado
        // Busca: [Cantidad] ... [Codigo: 5-14 dig]? [Nombre] ... $ [PrecioUn]
        const formalMatch = line.match(/^(\d+[\.,]\d*)\s*(?:[A-Za-z=]+)?\s+(\d{5,14})?\s*(.+?)\s+\$?\s*(\d+[\.,]\d{2})/i);
        if (formalMatch) {
            const quantity = parseFloat(formalMatch[1].replace(',', '.'));
            const code = formalMatch[2];
            let name = formalMatch[3].trim();
            const unitPrice = parseFloat(formalMatch[4].replace(',', '.'));

            // Limpieza del nombre
            name = name.replace(/^[:\-\|\\/]+\s*/, '').trim();

            // Si el código NO se detectó pero está al inicio del nombre
            if (!code) {
                const codeInside = name.match(/^(\d{5,14})\s+(.+)/);
                if (codeInside) {
                    result.items.push({ name: `${codeInside[1]} | ${codeInside[2]}`, quantity, costPrice: unitPrice });
                    return;
                }
            }

            result.items.push({
                name: code ? `${code} | ${name}` : name,
                quantity,
                costPrice: unitPrice
            });
            return;
        }

        // 2. Patrón "4 x 2200,00" (Para tickets de consumo masivo)
        const qtyMatch = line.match(/^(\d+(?:[\.,]\d+)?)\s*[xX*]\s*(\d+(?:[\.,]\d+)?)/);
        if (qtyMatch) {
            const quantity = parseFloat(qtyMatch[1].replace(',', '.'));
            const unitPrice = parseFloat(qtyMatch[2].replace(',', '.'));

            let name = "Producto Desconocido";
            const afterQty = line.split(/[xX*]/)[1]?.replace(/^\d+(?:[\.,]\d+)?\s*/, '').trim();
            if (afterQty && afterQty.length > 3) {
                name = afterQty.split(/\d+[\.,]\d{2}$/)[0].trim();
            } else if (index > 0 && !lines[index - 1].match(/\d+[,\.]\d{2}$/)) {
                name = lines[index - 1].trim();
            } else if (lines[index + 1]) {
                name = lines[index + 1].split(/\d+[\.,]\d{2}$/)[0].trim();
            }

            result.items.push({ name, quantity, costPrice: unitPrice });
            return;
        }

        // 3. Patrón "Cant Nombre Precio" (Ejemplo: "2 CERVEZA LAGER 2200.00")
        const fullMatch = line.match(/^(\d+)\s+(.+?)\s+(\d+[\.,]\d{2})$/);
        if (fullMatch) {
            const quantity = Number(fullMatch[1]);
            const name = fullMatch[2].trim();
            const price = parseFloat(fullMatch[3].replace(',', '.'));
            if (name.length > 2) {
                result.items.push({ name, quantity, costPrice: price });
                return;
            }
        }

        // 4. Patrón "Nombre Precio" (Cantidad implícita 1)
        if (line.match(/TOTAL|SUBTOTAL|FECHA|HORA|CUIT|CONSUMIDOR|IVA|NETO|GRAVADO|EXENTO/i)) return;

        const namePriceMatch = line.match(/^(.+?)\s+(\d+[\.,]\d{2})$/);
        if (namePriceMatch) {
            const name = namePriceMatch[1].trim();
            if (name.length < 3) return;

            const price = parseFloat(namePriceMatch[2].replace(',', '.'));

            const isDuplicate = result.items.some(item =>
                (name.includes(item.name) || item.name.includes(name)) &&
                Math.abs(item.costPrice - price) < 0.1
            );

            if (!isDuplicate) {
                result.items.push({ name, quantity: 1, costPrice: price });
            }
        }
    });

    return result;
}

import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-2.5-flash';

const INVOICE_PROMPT =
  'Analiza esta factura de proveedor y extrae SOLO los artículos físicos (piezas, componentes, productos). ' +
  'EXCLUYE líneas de: portes, transporte, envío, gastos de gestión, embalaje, descuentos, impuestos. ' +
  'Responde SOLO con JSON sin markdown: ' +
  '{"proveedor":"...","numero_factura":"...","fecha":"...","lineas":[{"descripcion":"...","referencia":"...","cantidad":1,"precio_unitario":0.00}],"total":0.00}';

export interface GeminiInvoiceLine {
  descripcion: string;
  referencia: string;
  cantidad: number;
  precio_unitario: number;
}

export interface GeminiInvoiceResult {
  proveedor: string;
  numero_factura: string;
  fecha: string;
  lineas: GeminiInvoiceLine[];
  total: number;
}

function parseResponse(text: string): GeminiInvoiceResult {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Gemini no devolvió JSON válido');
  return JSON.parse(match[0]) as GeminiInvoiceResult;
}

export async function analyzeInvoice(imageBase64: string, mimeType: string, apiKey: string): Promise<GeminiInvoiceResult> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: INVOICE_PROMPT },
        ],
      },
    ],
  });
  const text = response.text ?? '';
  return parseResponse(text);
}

export async function analyzeInvoiceText(invoiceText: string, apiKey: string): Promise<GeminiInvoiceResult> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        parts: [
          { text: `${INVOICE_PROMPT}\n\nContenido de la factura:\n${invoiceText.slice(0, 8000)}` },
        ],
      },
    ],
  });
  const text = response.text ?? '';
  return parseResponse(text);
}

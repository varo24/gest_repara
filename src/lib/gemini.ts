const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const INVOICE_PROMPT =
  'Analiza esta factura de proveedor y extrae todos los artículos. ' +
  'Responde SOLO con JSON sin markdown: ' +
  '{"proveedor": "string", "numero_factura": "string", "fecha": "string", ' +
  '"lineas": [{"descripcion": "string", "referencia": "string", "cantidad": number, "precio_unitario": number}], ' +
  '"total": number}';

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

async function callGemini(parts: object[], apiKey: string): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts?.[0]?.text as string) || '';
}

export async function analyzeInvoice(imageBase64: string, mimeType: string, apiKey: string): Promise<GeminiInvoiceResult> {
  const text = await callGemini(
    [
      { inline_data: { mime_type: mimeType, data: imageBase64 } },
      { text: INVOICE_PROMPT },
    ],
    apiKey,
  );
  return parseResponse(text);
}

export async function analyzeInvoiceText(invoiceText: string, apiKey: string): Promise<GeminiInvoiceResult> {
  const text = await callGemini(
    [{ text: `${INVOICE_PROMPT}\n\nContenido de la factura:\n${invoiceText.slice(0, 8000)}` }],
    apiKey,
  );
  return parseResponse(text);
}

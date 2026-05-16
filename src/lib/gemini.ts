import { GoogleGenAI, Type } from '@google/genai';

const MODEL = 'gemini-2.5-flash';

const INVOICE_PROMPT =
  'Analiza esta factura de proveedor. ' +
  'Extrae los datos del proveedor emisor (nombre, CIF/NIF, email, teléfono, dirección/ciudad) si aparecen en la cabecera. ' +
  'Extrae SOLO los artículos físicos (piezas, componentes, productos). ' +
  'EXCLUYE líneas de: portes, transporte, envío, gastos de gestión, embalaje, descuentos, impuestos.';

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
  cif_proveedor?: string;
  email_proveedor?: string;
  telefono_proveedor?: string;
  direccion_proveedor?: string;
}

const INVOICE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    proveedor:           { type: Type.STRING },
    numero_factura:      { type: Type.STRING },
    fecha:               { type: Type.STRING },
    total:               { type: Type.NUMBER },
    cif_proveedor:       { type: Type.STRING },
    email_proveedor:     { type: Type.STRING },
    telefono_proveedor:  { type: Type.STRING },
    direccion_proveedor: { type: Type.STRING },
    lineas: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          descripcion:     { type: Type.STRING },
          referencia:      { type: Type.STRING },
          cantidad:        { type: Type.NUMBER },
          precio_unitario: { type: Type.NUMBER },
        },
        required: ['descripcion', 'referencia', 'cantidad', 'precio_unitario'],
      },
    },
  },
  required: ['proveedor', 'numero_factura', 'fecha', 'lineas', 'total'],
};

function classifyError(error: any): Error {
  const status = error?.status ?? error?.response?.status;
  if (status === 401 || status === 403)
    return new Error('Clave API de Gemini inválida o sin permisos. Revísala en Ajustes.');
  if (status === 429)
    return new Error('Cuota de Gemini agotada. Espera unos minutos y vuelve a intentarlo.');
  if (error?.name === 'AbortError' || String(error?.message).toLowerCase().includes('timeout'))
    return new Error('La solicitud a Gemini tardó demasiado. Comprueba tu conexión.');
  return new Error(error?.message || 'Error desconocido al contactar con Gemini.');
}

export async function analyzeInvoice(
  imageBase64: string,
  mimeType: string,
  apiKey: string,
): Promise<GeminiInvoiceResult> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: INVOICE_PROMPT }] }],
      config: { responseMimeType: 'application/json', responseSchema: INVOICE_SCHEMA },
    });
    return JSON.parse(response.text ?? '{}') as GeminiInvoiceResult;
  } catch (error: any) {
    throw classifyError(error);
  }
}

export async function analyzeInvoiceText(
  invoiceText: string,
  apiKey: string,
): Promise<GeminiInvoiceResult> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ parts: [{ text: `${INVOICE_PROMPT}\n\nContenido de la factura:\n${invoiceText.slice(0, 8000)}` }] }],
      config: { responseMimeType: 'application/json', responseSchema: INVOICE_SCHEMA },
    });
    return JSON.parse(response.text ?? '{}') as GeminiInvoiceResult;
  } catch (error: any) {
    throw classifyError(error);
  }
}

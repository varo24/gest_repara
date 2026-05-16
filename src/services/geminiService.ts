
import { GoogleGenAI, Type } from "@google/genai";
import { logError } from '../lib/errorLogger';

export const getSmartDiagnosis = async (device: string, brand: string, problem: string) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  // [DEBUG] Temporal — eliminar tras verificar
  console.log('[Gemini] apiKey presente:', !!apiKey);
  console.log('[Gemini] modelo:', 'gemini-2.5-flash');

  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
    console.warn("Gemini API Key no encontrada.");
    return null;
  }

  // [DEBUG] Temporal — eliminar tras verificar
  const requestPayload = {
    model: 'gemini-2.5-flash',
    contents: `Analiza este reporte de avería técnica:
      Equipo: ${device}
      Marca: ${brand}
      Problema reportado: ${problem}`,
    config: {
      systemInstruction: "Eres un ingeniero senior de servicio técnico especializado en electrodomésticos y dispositivos electrónicos. Analiza fallos de forma profesional y genera un informe técnico en formato JSON con causas probables, repuestos estimados, tiempo estimado y consejos de seguridad. Responde SIEMPRE en español.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          possibleCauses:  { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de causas técnicas probables" },
          suggestedParts:  { type: Type.ARRAY, items: { type: Type.STRING }, description: "Repuestos necesarios para la reparación" },
          estimatedTime:   { type: Type.STRING, description: "Tiempo estimado de intervención (ej: 2-3 horas)" },
          technicalAdvice: { type: Type.STRING, description: "Consejo de seguridad técnica para manipular el equipo" },
          difficultyLevel: { type: Type.STRING, description: "Nivel de dificultad: Básico, Intermedio o Avanzado" },
        },
        required: ["possibleCauses", "suggestedParts", "estimatedTime", "technicalAdvice", "difficultyLevel"],
      },
    },
  };
  console.debug('[Gemini] Request payload:', JSON.stringify(requestPayload, null, 2));

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent(requestPayload);

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error: any) {
    // [DEBUG] Temporal — eliminar tras verificar
    console.error('[Gemini] Error completo:', error);
    console.error('[Gemini] error.message:', error?.message);
    console.error('[Gemini] error.status:', error?.status);
    console.error('[Gemini] error.statusText:', error?.statusText);
    // La SDK de Google puede adjuntar el body de respuesta en distintos campos
    console.error('[Gemini] error.errorDetails:', error?.errorDetails);
    console.error('[Gemini] error.response:', error?.response);
    try {
      const body = await error?.response?.json?.();
      console.error('[Gemini] error.response body (parsed):', body);
    } catch {
      console.error('[Gemini] error.response body: no disponible o ya consumido');
    }
    logError('uncaught', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
};

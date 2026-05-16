
import { GoogleGenAI, Type } from "@google/genai";
import { logError } from '../lib/errorLogger';

export const getSmartDiagnosis = async (device: string, brand: string, problem: string) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
    console.warn("Gemini API Key no encontrada.");
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
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
            possibleCauses: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista de causas técnicas probables"
            },
            suggestedParts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Repuestos necesarios para la reparación"
            },
            estimatedTime: {
              type: Type.STRING,
              description: "Tiempo estimado de intervención (ej: 2-3 horas)"
            },
            technicalAdvice: {
              type: Type.STRING,
              description: "Consejo de seguridad técnica para manipular el equipo"
            },
            difficultyLevel: {
              type: Type.STRING,
              description: "Nivel de dificultad: Básico, Intermedio o Avanzado"
            }
          },
          required: ["possibleCauses", "suggestedParts", "estimatedTime", "technicalAdvice", "difficultyLevel"]
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("Error en el servicio Gemini:", error);
    logError('uncaught', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
};

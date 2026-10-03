
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Generates realistic maritime particulars for a given ship using the Gemini AI model.
 */
export async function generateSmartParticulars(shipName: string, shipType: string) {
  try {
    // Instantiate right before making the call to ensure the latest API key is used
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate realistic maritime particulars for a ship named "${shipName}" of type "${shipType}". Return JSON only.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lengthOverall: { type: Type.NUMBER },
            breadthOverall: { type: Type.NUMBER },
            displacement: { type: Type.NUMBER },
            stemToStandard: { type: Type.NUMBER },
            stemToBridge: { type: Type.NUMBER },
            stemToRas: { type: Type.NUMBER },
            stemToFueling: { type: Type.NUMBER },
          },
          required: ["lengthOverall", "breadthOverall", "displacement", "stemToStandard", "stemToBridge", "stemToRas", "stemToFueling"]
        }
      }
    });
    
    // Use the .text property directly from the response
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
}

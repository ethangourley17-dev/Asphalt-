import { GoogleGenAI, Type } from "@google/genai";
import { RecognitionResult } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const identifyTruck = async (base64Image: string): Promise<RecognitionResult> => {
  try {
    // Clean base64 string if it has headers
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64
            }
          },
          {
            text: "Analyze this image of a truck on a scale. 1. Identify the License Plate Number. 2. Give a confidence score (0-1). Return JSON."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            licensePlate: {
              type: Type.STRING,
              description: "The alphanumeric license plate number. If not visible, return 'UNKNOWN'.",
            },
            confidence: {
              type: Type.NUMBER,
              description: "Confidence score between 0 and 1.",
            }
          }
        }
      }
    });

    if (response.text) {
        const data = JSON.parse(response.text);
        // Normalize plate: remove spaces, uppercase
        return {
            licensePlate: data.licensePlate.replace(/\s/g, '').toUpperCase(),
            confidence: data.confidence
        };
    }
    
    throw new Error("No response from AI");

  } catch (error) {
    console.error("Gemini Recognition Error:", error);
    return {
      licensePlate: "UNKNOWN",
      confidence: 0
    };
  }
};
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
            text: "Extract the license plate number from this truck image."
          }
        ]
      },
      config: {
        systemInstruction: "You are an automated License Plate Recognition (ALPR) system for a truck scale. Your job is to accurately extract the license plate characters from the provided image. If the plate is partially obscured, make your best guess based on visible characters. Return the result in JSON format.",
        temperature: 0.4, // Lower temperature for more deterministic results
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            licensePlate: {
              type: Type.STRING,
              description: "The alphanumeric license plate number. Remove all spaces and special characters. If not visible, return 'UNKNOWN'.",
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
        // Normalize plate: remove spaces, uppercase, remove hyphens common in manual entry
        const normalizedPlate = data.licensePlate.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        return {
            licensePlate: normalizedPlate || "UNKNOWN",
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
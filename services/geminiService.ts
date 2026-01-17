
import { GoogleGenAI, Type } from "@google/genai";

// State for Key Management
let ai: GoogleGenAI | null = null;
let allKeys: string[] = [];
let currentKeyIndex: number = 0;

// Groq State
let groqApiKey: string = "";

/**
 * Parses a string of keys (comma or newline separated) and sets the active list.
 */
export const initializeKeys = (geminiKeyString: string, groqKeyString: string = "") => {
  // 1. Setup Gemini Keys
  if (geminiKeyString) {
    const parsed = geminiKeyString.split(/[\n,]+/).map(k => k.trim()).filter(k => k.length > 0);
    const isDifferent = parsed.length !== allKeys.length || !parsed.every((val, index) => val === allKeys[index]);
    
    if (isDifferent) {
      allKeys = parsed;
      currentKeyIndex = 0;
      ai = null; 
    }
  } else {
    allKeys = [];
  }

  // 2. Setup Groq Key
  if (groqKeyString) {
    groqApiKey = groqKeyString.trim();
  } else {
    groqApiKey = "";
  }
};

export const getStoredApiKeys = (): { gemini: string, groq: string } => {
  if (typeof window === 'undefined') return { gemini: '', groq: '' };
  
  const params = new URLSearchParams(window.location.search);
  const urlKey = params.get('key') || params.get('apiKey');

  return {
    gemini: urlKey || localStorage.getItem('gemini_api_key') || '',
    groq: localStorage.getItem('groq_api_key') || ''
  };
};

// Backwards compatibility wrapper
export const getStoredApiKey = () => getStoredApiKeys().gemini;

export const setStoredApiKeys = (geminiKey: string, groqKey: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('gemini_api_key', geminiKey);
  localStorage.setItem('groq_api_key', groqKey);
  
  initializeKeys(geminiKey, groqKey);
};

// Backwards compatibility wrapper
export const setStoredApiKey = (key: string) => setStoredApiKeys(key, groqApiKey);


const getAiClient = () => {
  // 1. Check for Environment Variable (Vite / Process)
  // Use try-catch to safely check process.env in environments where it might not exist
  let envKey = "";
  try {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      envKey = process.env.API_KEY;
    } else if (import.meta && (import.meta as any).env && (import.meta as any).env.VITE_API_KEY) {
      envKey = (import.meta as any).env.VITE_API_KEY;
    }
  } catch (e) {
    // Ignore env errors
  }

  if (envKey) {
     if (!ai) ai = new GoogleGenAI({ apiKey: envKey });
     return ai;
  }

  // 2. Check for Manual/Stored Keys
  if (allKeys.length === 0) {
    const stored = getStoredApiKeys();
    initializeKeys(stored.gemini, stored.groq);
  }

  if (allKeys.length === 0) {
     throw new Error("No Gemini API Key found. Please add a key in settings.");
  }

  if (!ai) {
    const activeKey = allKeys[currentKeyIndex];
    ai = new GoogleGenAI({ apiKey: activeKey });
  }

  return ai;
};

const rotateKey = (): boolean => {
  // Rotation only applies to manual keys list
  if (allKeys.length <= 1) return false;
  const prevIndex = currentKeyIndex;
  currentKeyIndex = (currentKeyIndex + 1) % allKeys.length;
  ai = null; 
  console.log(`Quota hit on key #${prevIndex + 1}. Switching to key #${currentKeyIndex + 1}`);
  return true;
};

// --- ERROR DETECTION HELPER ---

const isQuotaError = (error: any): boolean => {
  if (!error) return false;
  
  // 1. Check Top-Level Code/Status (Standard Error Object)
  const code = error.status || error.code || error.response?.status;
  if (Number(code) === 429) return true;
  if (Number(code) === 503) return true; // Service Overloaded often treated as retryable/quota-like

  // 2. Check Nested Error Object (Google JSON Error Structure)
  // Structure: { error: { code: 429, message: "...", status: "RESOURCE_EXHAUSTED" } }
  if (error.error) {
      const nestedCode = error.error.code || error.error.status;
      if (Number(nestedCode) === 429) return true;
      if (String(error.error.status).toUpperCase().includes('RESOURCE_EXHAUSTED')) return true;
  }

  // 3. Check Status Text
  const statusStr = String(error.statusText || error.status || "").toUpperCase();
  if (statusStr.includes('RESOURCE_EXHAUSTED')) return true;
  if (statusStr.includes('TOO MANY REQUESTS')) return true;

  // 4. Check Error Messages (String Matching)
  const msg = (error.message || error.error?.message || JSON.stringify(error)).toLowerCase();
  return (
    msg.includes('quota') || 
    msg.includes('429') || 
    msg.includes('resource_exhausted') || 
    msg.includes('too many requests')
  );
};

// --- KEY VERIFICATION ---

export const verifyGeminiKey = async (keyString: string): Promise<'valid' | 'invalid' | 'quota'> => {
  // Extract first key if multiple
  const keys = keyString.split(/[\n,]+/).map(k => k.trim()).filter(k => k.length > 0);
  if (keys.length === 0) return 'invalid';
  
  const keyToTest = keys[0]; // Test the first one
  try {
    const client = new GoogleGenAI({ apiKey: keyToTest });
    await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'Test',
    });
    return 'valid';
  } catch (error: any) {
    console.error("Gemini Verification Failed:", error);
    if (isQuotaError(error)) {
        return 'quota';
    }
    return 'invalid';
  }
};

export const verifyGroqKey = async (key: string): Promise<boolean> => {
  if (!key.trim()) return false;
  try {
     const response = await fetch("https://api.groq.com/openai/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${key.trim()}`,
        "Content-Type": "application/json"
      }
    });
    return response.ok;
  } catch (error) {
    console.error("Groq Verification Failed:", error);
    return false;
  }
};


// --- GROQ INTEGRATION (Fallback) ---

const callGroqBatch = async (
  items: { text: string, context?: string }[],
  sourceLang: 'ar' | 'en' | 'auto',
  targetLang: 'ar' | 'en' | 'auto'
): Promise<string[]> => {
  if (!groqApiKey) throw new Error("No Groq API Key configured.");

  const texts = items.map(i => i.text); // Groq fallback is basic, no context logic for now to keep it simple
  
  const prompt = `
    You are a professional translator. 
    Translate the following array of texts.
    
    Source: ${sourceLang === 'auto' ? 'Auto Detect (Arabic or English)' : sourceLang}
    Target: ${targetLang === 'auto' ? 'Switch (If Ar->En, If En->Ar)' : targetLang}
    
    IMPORTANT RULES:
    1. Return ONLY a valid JSON Array of strings.
    2. Maintain the exact order.
    3. Do not include markdown formatting like \`\`\`json.
    
    Input:
    ${JSON.stringify(texts)}
  `;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "You are a helpful assistant that outputs only JSON." },
          { role: "user", content: prompt }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        response_format: { type: "json_object" } 
      })
    });

    if (!response.ok) {
       const err = await response.json();
       throw new Error(`Groq API Error: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "[]";
    
    let parsed;
    try {
        parsed = JSON.parse(content);
        if (!Array.isArray(parsed) && typeof parsed === 'object') {
            const values = Object.values(parsed);
            if (values.length > 0 && Array.isArray(values[0])) {
                parsed = values[0];
            }
        }
    } catch (e) {
        const clean = content.replace(/```json|```/g, '');
        parsed = JSON.parse(clean);
    }

    if (Array.isArray(parsed)) {
       return parsed.map(s => String(s));
    }
    throw new Error("Groq did not return a valid array");

  } catch (error: any) {
    console.error("Groq Call Failed:", error);
    throw error;
  }
};


// --- MAIN TRANSLATION FUNCTION (UPGRADED) ---

export const translateBatch = async (
  items: { text: string, context?: string }[],
  config: {
    sourceLang: 'ar' | 'en' | 'auto',
    targetLang: 'ar' | 'en' | 'auto',
    domain?: string,
    glossary?: string[]
  }
): Promise<string[]> => {
  if (items.length === 0) return [];

  // --- ATTEMPT 1: GEMINI PRO (High Quality) ---
  const model = 'gemini-3-pro-preview';
  const responseSchema = {
    type: Type.ARRAY,
    items: { type: Type.STRING }
  };

  const domainInstruction = config.domain ? `Domain Context: ${config.domain} (Translate terms specifically for this industry).` : "";
  const glossaryInstruction = config.glossary && config.glossary.length > 0 
      ? `Glossary (Keep these Exact): ${config.glossary.join(', ')}.` 
      : "";

  let taskInstruction = "";
  if (config.sourceLang === 'auto' || config.targetLang === 'auto') {
      taskInstruction = `
        **Smart Auto-Detect Mode**:
        For each string in the array:
        1. Detect if it is primarily Arabic or English.
        2. If Arabic -> Translate to English.
        3. If English -> Translate to Arabic.
        4. If it's a mix, translate the part that needs translation to make it bilingual.
      `;
  } else {
      taskInstruction = `Translate from ${config.sourceLang === 'ar' ? 'Arabic' : 'English'} to ${config.targetLang === 'ar' ? 'Arabic' : 'English'}.`;
  }

  // Construct structured prompt for Context awareness
  const prompt = `
    You are a highly consistent professional translator.
    ${domainInstruction}
    ${glossaryInstruction}
    
    ${taskInstruction}
    
    **STRICT RULES**:
    1. Return ONLY a JSON Array of strings. No keys, no markdown.
    2. Maintain exact order. Output Length must match Input Length.
    3. Consistency is key. "Hot" must always translate to the same word in this batch.
    4. If the input is just a number or symbol, return it as is.
    
    **Input Data**:
    ${JSON.stringify(items)}
  `;

  // Determine max attempts based on key availability
  const maxAttempts = Math.max(1, allKeys.length * 1.5);
  
  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      const client = getAiClient();
      
      const response = await client.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.1, // LOW TEMPERATURE FOR CONSISTENCY
        }
      });

      const jsonText = response.text?.trim();
      if (!jsonText) throw new Error("Empty response from AI");
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed)) return parsed.map(s => String(s));

    } catch (error: any) {
      const isQuota = isQuotaError(error);
      
      // --- FAILOVER: GROQ ---
      // Only failover if using manually provided keys and quota hits
      if (isQuota && groqApiKey) {
         console.warn("Gemini Rate Limit Hit. Switching to Groq fallback...");
         try {
            return await callGroqBatch(items, config.sourceLang, config.targetLang);
         } catch (groqError) {
            console.error("Groq Fallback also failed:", groqError);
         }
      }

      if (isQuota) {
        const rotated = rotateKey();
        if (rotated) {
          await new Promise(r => setTimeout(r, 1000));
          continue; 
        }
      }
      
      if (attempt === maxAttempts) throw error;
    }
  }
  
  throw new Error("Translation failed.");
};


// --- SCRAPING FUNCTION (TEXT) ---

export const extractStructuredData = async (
  rawText: string,
  instruction: string
): Promise<any[]> => {
  const model = 'gemini-3-pro-preview';
  
  const prompt = `
    You are an advanced data scraper.
    
    Your Task: Extract structured data from the provided raw web page text based on this instruction: "${instruction}".
    
    Rules:
    1. Return a JSON ARRAY of objects.
    2. Extract only the requested fields.
    3. If a field is missing, use an empty string or null.
    4. Clean up values (remove currency symbols, extra whitespace).
    5. If no data matches the instruction, return an empty array [].
    
    Source Text:
    """
    ${rawText.slice(0, 50000)} 
    """
    (Text truncated to 50k chars if longer)
  `;

  const maxAttempts = Math.max(1, allKeys.length * 1.5);

  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      const client = getAiClient();
      
      const response = await client.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const jsonText = response.text?.trim();
      if (!jsonText) throw new Error("Empty response from AI");
      
      // Cleaning Markdown if present
      const cleanJson = jsonText.replace(/```json|```/g, '');
      const parsed = JSON.parse(cleanJson);
      
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'object') {
        const values = Object.values(parsed);
        if (values.length > 0 && Array.isArray(values[0])) return values[0] as any[];
      }
      
      throw new Error("AI did not return an array.");

    } catch (error: any) {
      if (isQuotaError(error)) {
        const rotated = rotateKey();
        if (rotated) {
          await new Promise(r => setTimeout(r, 1000));
          continue; 
        }
      }
      if (attempt === maxAttempts) throw error;
    }
  }
  return [];
};


// --- OCR / MULTIMODAL EXTRACTION ---

export const extractFromMedia = async (
  mediaData: { data: string, mimeType: string },
  instruction: string
): Promise<any[]> => {
  // We use gemini-3-pro-preview as it is multimodal and handles complex layouts better
  const model = 'gemini-3-pro-preview';
  
  const prompt = `
    You are an expert AI specialized in Optical Character Recognition (OCR) and Document Understanding.
    Your task is to extract structured data from the provided image or PDF.
    
    User Instruction: "${instruction}"

    CRITICAL RULES FOR EXTRACTION:
    1. **Visual Layout Analysis & Categorization**: 
       - Analyze the document layout (columns, headers, sections).
       - **ALWAYS** identify section headers (e.g., "Appetizers", "Shawarma", "Brost", "Date").
       - **MANDATORY**: Include a field named "Category" (or "Section") in every extracted object.
    
    2. **Multilingual Translation & Concatenation (ALL FIELDS)**: 
       - Apply this rule to: 'Name', 'Description', 'Category', 'VariantLabel', 'VariantValue'.
       - **Detect Language**:
         - If text is **Arabic only**: Translate to English and format as "Arabic - English".
         - If text is **English only**: Translate to Arabic and format as "English - Arabic".
         - If text is **Mixed** (contains BOTH Arabic and English script): **KEEP AS IS**. Do NOT translate. Do NOT duplicate.
         - Example (Mixed): "Chicken Burger برجر دجاج" -> Output: "Chicken Burger برجر دجاج".
         - Example (Arabic): "بطاطس" -> Output: "بطاطس - Fries".
    
    3. **Variable Product Detection (Aggressive Splitting)**:
       - **CRITICAL**: If an item line contains multiple choices/sizes (e.g. "Spicy / Regular", "Small / Large", "Sandwich / Meal"), you must **SPLIT** this into separate JSON objects.
       - **Do NOT** put all options in one cell. Create a new row for each option.
       - **Fields**:
         - 'Name': The main item name (Apply Rule 2).
         - 'Description': Any details below the name (Apply Rule 2).
         - 'VariantLabel': The nature of the option (e.g. "Flavor", "Size", "Type").
         - 'VariantValue': The specific choice (e.g. "Spicy", "Regular"). (Apply Rule 2).
         - 'Price': The price corresponding to that choice.
         - 'Type': Set to "Variable".
       
       - **Example**: 
         Image text: "Brost .... 18 .... (Spicy / Regular)"
         Output JSON:
         [
           {"Name": "Brost - بروست", "VariantLabel": "Flavor", "VariantValue": "Spicy - حراق", "Price": 18, "Type": "Variable"},
           {"Name": "Brost - بروست", "VariantLabel": "Flavor", "VariantValue": "Regular - عادي", "Price": 18, "Type": "Variable"}
         ]
         
    4. **Simple Products**:
       - If an item has NO options, set 'Type' to "Simple" and leave Variant fields empty.
    
    5. **Output Format**: 
       - RETURN ONLY A VALID JSON ARRAY of objects.
       - Do not wrap in markdown code blocks (\`\`\`json). Just the raw JSON string.
    
    Start extraction now.
  `;

  const maxAttempts = Math.max(1, allKeys.length * 1.5);

  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      const client = getAiClient();
      
      const response = await client.models.generateContent({
        model: model,
        contents: {
          parts: [
            { inlineData: mediaData },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
        }
      });

      const jsonText = response.text?.trim();
      if (!jsonText) throw new Error("Empty response from AI");

      const cleanJson = jsonText.replace(/```json|```/g, '');
      let parsed;
      try {
        parsed = JSON.parse(cleanJson);
      } catch (e) {
        console.warn("JSON Parse Failed", e);
        throw new Error("AI returned invalid JSON.");
      }
      
      if (Array.isArray(parsed)) return parsed;
      // If mapped under a key
      if (typeof parsed === 'object') {
        const values = Object.values(parsed);
        if (values.length > 0 && Array.isArray(values[0])) return values[0] as any[];
        // Single object return? Wrap in array
        return [parsed];
      }
      
      throw new Error("AI output format unrecognized (not array or object).");

    } catch (error: any) {
      if (isQuotaError(error)) {
        const rotated = rotateKey();
        if (rotated) {
          await new Promise(r => setTimeout(r, 1000));
          continue; 
        }
      }
      if (attempt === maxAttempts) throw error;
    }
  }
  return [];
};

import { getCategoryForField } from "./categories";

export interface ParsedField {
  originalName: string;
  value: string;
  category: string;
  isKnown: boolean;
}

export function parseXmlPayload(xmlString: string): { fields: ParsedField[], error: string | null } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "text/xml");

    // Check for parsing errors specifically reported by the browser's DOMParser
    const parseError = doc.querySelector("parsererror");
    if (parseError) {
       return { fields: [], error: "Invalid XML format. Please check the syntax." };
    }

    const results: Map<string, ParsedField> = new Map();

    const addField = (name: string, value: string) => {
      const cleanName = name.trim();
      const cleanValue = value.trim();
      if (!cleanName) return;

      const category = getCategoryForField(cleanName);
      
      // Use lowercase name as key to avoid duplicates, but keep original case
      const key = cleanName.toLowerCase();
      if (!results.has(key)) {
        results.set(key, {
          originalName: cleanName,
          value: cleanValue,
          category,
          isKnown: category !== "Other"
        });
      }
    };

    // Strategy 1: <extraction name="..." value="..." />
    const extractions = doc.querySelectorAll("extraction[name]");
    extractions.forEach(el => {
      const name = el.getAttribute("name");
      const value = el.getAttribute("value");
      if (name && value !== null) addField(name, value);
    });

    // Strategy 2: <field name="..."><value>...</value></field>
    const fields = doc.querySelectorAll("field[name]");
    fields.forEach(el => {
      const name = el.getAttribute("name");
      const valueEl = el.querySelector("value");
      if (name && valueEl) addField(name, valueEl.textContent || "");
    });

    // Strategy 3: <item><name>...</name><value>...</value></item>
    const items = doc.querySelectorAll("item");
    items.forEach(el => {
      const nameEl = el.querySelector("name");
      const valueEl = el.querySelector("value");
      if (nameEl && valueEl) {
        addField(nameEl.textContent || "", valueEl.textContent || "");
      }
    });

    if (results.size === 0) {
      return { fields: [], error: "No extracted fields found in the XML. Ensure it matches expected structures." };
    }

    return { fields: Array.from(results.values()), error: null };

  } catch (e) {
    return { fields: [], error: "An unexpected error occurred while parsing the XML." };
  }
}

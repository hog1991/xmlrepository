import { getCategoryForField } from "./categories";

export interface ParsedField {
  originalName: string;
  value: string;
  category: string;
  isKnown: boolean;
}

// ─── Helpers for AIExtractions / RepeatableFieldCollections format ────────────

/** Returns the text of a direct child element with the given tag name. */
function getDirectChildText(el: Element, tag: string): string {
  for (const child of Array.from(el.children)) {
    if (child.tagName === tag) return child.textContent?.trim() ?? "";
  }
  return "";
}

/** Returns true when <HasExtraction>true</HasExtraction> is a direct child. */
function isExtracted(fieldEl: Element): boolean {
  return getDirectChildText(fieldEl, "HasExtraction") === "true";
}

/**
 * Extracts a human-readable value from a RepeatableFieldCollections <Field> node.
 * Preference order:
 *   1. <FormattedValue><Value>text</Value></FormattedValue>
 *   2. <FormattedValue><Fields><Field><Label>3 Years</Label>...</Field></Fields></FormattedValue>
 *   3. <FormattedValue><Year><Label>3 Years</Label>...</Year></FormattedValue>  (FlattenedFieldCollections variant)
 *   4. <Value>rawValue</Value>
 */
function getFormattedOrRaw(fieldEl: Element): string {
  const fv = Array.from(fieldEl.children).find(c => c.tagName === "FormattedValue");
  if (fv) {
    // Pattern 1: direct <Value> inside FormattedValue
    const directVal = Array.from(fv.children).find(c => c.tagName === "Value");
    if (directVal?.textContent?.trim()) return directVal.textContent.trim();

    // Pattern 2: <Fields><Field><Label>N Units</Label>...</Field></Fields>
    const fieldsEl = Array.from(fv.children).find(c => c.tagName === "Fields");
    if (fieldsEl) {
      const labels = Array.from(fieldsEl.children)
        .filter(c => c.tagName === "Field")
        .map(f => getDirectChildText(f, "Label"))
        .filter(Boolean);
      if (labels.length) return labels.join(", ");
    }

    // Pattern 3: <UnitName><Label>N Units</Label>...</UnitName>  (FlattenedFieldCollections)
    for (const child of Array.from(fv.children)) {
      if (child.tagName !== "Value" && child.tagName !== "Fields") {
        const label = Array.from(child.children).find(c => c.tagName === "Label");
        if (label?.textContent?.trim()) return label.textContent.trim();
      }
    }
  }

  // Fallback: raw <Value>
  const valEl = Array.from(fieldEl.children).find(c => c.tagName === "Value");
  return valEl?.textContent?.trim() ?? "";
}

/** Returns the direct <Field> children nested inside the element's <Fields> child. */
function getChildFields(el: Element): Element[] {
  const fieldsEl = Array.from(el.children).find(c => c.tagName === "Fields");
  if (!fieldsEl) return [];
  return Array.from(fieldsEl.children).filter(c => c.tagName === "Field");
}

/** Finds a child field by its <Name> text inside el's <Fields>. */
function findChildByName(el: Element, name: string): Element | null {
  return getChildFields(el).find(f => getDirectChildText(f, "Name") === name) ?? null;
}

/** Formats a monetary value from doubleValue + currencyCode child fields. */
function formatMonetary(dvEl: Element | null, ccEl: Element | null): string {
  const amount = dvEl ? getFormattedOrRaw(dvEl) : "";
  const currency = ccEl ? getFormattedOrRaw(ccEl) : "";
  if (!amount) return currency || "";
  const num = parseFloat(amount);
  const formatted = !isNaN(num) ? num.toLocaleString("en-US") : amount;
  return currency ? `${currency} ${formatted}` : formatted;
}

/** Converts raw role enum values to readable strings. */
function formatRole(raw: string): string {
  const map: Record<string, string> = {
    SELLER: "Seller", BUYER: "Buyer", VENDOR: "Vendor", CUSTOMER: "Customer",
    LICENSOR: "Licensor", LICENSEE: "Licensee", PROVIDER: "Provider",
    CLIENT: "Client", CONTRACTOR: "Contractor", PARTNER: "Partner",
  };
  return map[raw] ?? raw.charAt(0) + raw.slice(1).toLowerCase().replace(/_/g, " ");
}

// ─── AIExtractions / RepeatableFieldCollections parser ───────────────────────

function parseAIExtractionsFormat(doc: Document): ParsedField[] | null {
  const rfc = doc.querySelector("AIExtractions > RepeatableFieldCollections");
  if (!rfc) return null;

  const topFields = Array.from(rfc.children).filter(c => c.tagName === "Field");
  if (topFields.length === 0) return null;

  const collected: Array<{ name: string; value: string }> = [];
  const push = (name: string, value: string) => collected.push({ name, value });

  for (const tf of topFields) {
    const fname = getDirectChildText(tf, "Name");

    switch (fname) {
      case "agreementType": {
        const f = findChildByName(tf, "value");
        push("Agreement Type", f && isExtracted(f) ? getFormattedOrRaw(f) : "");
        break;
      }
      case "totalValue": {
        const vf = findChildByName(tf, "value");
        const dv = vf ? findChildByName(vf, "doubleValue") : null;
        const cv = vf ? findChildByName(vf, "currencyCode") : null;
        const hasVal = (dv && isExtracted(dv)) || (cv && isExtracted(cv));
        push("Total Contract Value", hasVal ? formatMonetary(dv, cv) : "");
        break;
      }
      case "annualValue": {
        const vf = findChildByName(tf, "value");
        const dv = vf ? findChildByName(vf, "doubleValue") : null;
        const cv = vf ? findChildByName(vf, "currencyCode") : null;
        const hasVal = (dv && isExtracted(dv)) || (cv && isExtracted(cv));
        push("Annual Contract Value", hasVal ? formatMonetary(dv, cv) : "");
        break;
      }
      case "governingLaw": {
        const f = findChildByName(tf, "value");
        push("Governing Law", f && isExtracted(f) ? getFormattedOrRaw(f) : "");
        break;
      }
      case "jurisdiction": {
        const f = findChildByName(tf, "value");
        push("Jurisdiction and Venue", f && isExtracted(f) ? getFormattedOrRaw(f) : "");
        break;
      }
      case "paymentTerms": {
        const f = findChildByName(tf, "type");
        push("Payment Terms", f && isExtracted(f) ? getFormattedOrRaw(f) : "");
        break;
      }
      case "forCauseTermination": {
        const f = findChildByName(tf, "noticePeriod");
        push("Termination for Cause \u2013 Notice Period", f && isExtracted(f) ? getFormattedOrRaw(f) : "");
        break;
      }
      case "forConvenienceTermination": {
        const f = findChildByName(tf, "noticePeriod");
        push("Termination for Convenience \u2013 Notice Period", f && isExtracted(f) ? getFormattedOrRaw(f) : "");
        break;
      }
      case "title": {
        const f = findChildByName(tf, "value");
        push("Title", f && isExtracted(f) ? getFormattedOrRaw(f) : "");
        break;
      }
      case "executionDate": {
        const f = findChildByName(tf, "value");
        push("Execution Date", f && isExtracted(f) ? getFormattedOrRaw(f) : "");
        break;
      }
      case "effectiveDate": {
        const f = findChildByName(tf, "value");
        push("Effective Date", f && isExtracted(f) ? getFormattedOrRaw(f) : "");
        break;
      }
      case "expirationDate": {
        const f = findChildByName(tf, "value");
        push("Expiration Date", f && isExtracted(f) ? getFormattedOrRaw(f) : "");
        break;
      }
      case "lineOfBusiness": {
        const f = findChildByName(tf, "value");
        push("Line of Business", f && isExtracted(f) ? getFormattedOrRaw(f) : "");
        break;
      }
      case "term": {
        const f = findChildByName(tf, "value");
        push("Term Length (initial/overall term)", f && isExtracted(f) ? getFormattedOrRaw(f) : "");
        break;
      }
      case "assignment": {
        const typeF = findChildByName(tf, "type");
        push("Assignment (General)", typeF && isExtracted(typeF) ? getFormattedOrRaw(typeF) : "");

        const cocF = findChildByName(tf, "changeOfControl");
        push("Assignment on Change of Control", cocF && isExtracted(cocF) ? getFormattedOrRaw(cocF) : "");

        const trF = findChildByName(tf, "terminationRights");
        push("Assignment Termination Rights", trF && isExtracted(trF) ? getFormattedOrRaw(trF) : "");
        break;
      }
      case "latePaymentFee": {
        const canCharge = findChildByName(tf, "canChargeLatePaymentFees");
        push("Can charge late payment fees?", canCharge && isExtracted(canCharge) ? getFormattedOrRaw(canCharge) : "");

        const pct = findChildByName(tf, "latePaymentFeePercent");
        push("Late Payment Fee Percent", pct && isExtracted(pct) ? getFormattedOrRaw(pct) : "");
        break;
      }
      case "priceCap": {
        const f = findChildByName(tf, "increase");
        push("Price Cap Increase percentage", f && isExtracted(f) ? getFormattedOrRaw(f) : "");
        break;
      }
      case "liabilityCap": {
        const fixedAmount = findChildByName(tf, "fixedAmount");
        const dv = fixedAmount ? findChildByName(fixedAmount, "doubleValue") : null;
        const cv = fixedAmount ? findChildByName(fixedAmount, "currencyCode") : null;
        const hasCapVal = (dv && isExtracted(dv)) || (cv && isExtracted(cv));
        push("Limitation of Liability Cap Amount", hasCapVal ? formatMonetary(dv, cv) : "");

        const mult = findChildByName(tf, "multiplier");
        push("Limitation of Liability Cap Multiplier", mult && isExtracted(mult) ? getFormattedOrRaw(mult) : "");

        const dur = findChildByName(tf, "duration");
        push("Limitation of Liability Cap Duration", dur && isExtracted(dur) ? getFormattedOrRaw(dur) : "");
        break;
      }
      case "renewal": {
        const typeF = findChildByName(tf, "type");
        const renewalFormatted = typeF && isExtracted(typeF) ? getFormattedOrRaw(typeF) : "";
        const rawType = typeF ? getDirectChildText(typeF, "Value") : "";

        if (rawType === "EVERGREEN") {
          push("Term \u2013 Evergreen", renewalFormatted || "Yes");
          push("Auto Renewal (Y/N)", "Yes (Evergreen)");
        } else if (renewalFormatted) {
          push("Auto Renewal (Y/N)", renewalFormatted);
          push("Term \u2013 Evergreen", "");
        } else {
          push("Auto Renewal (Y/N)", "");
          push("Term \u2013 Evergreen", "");
        }

        const termF = findChildByName(tf, "term");
        push("Renewal Term", termF && isExtracted(termF) ? getFormattedOrRaw(termF) : "");

        const noticeF = findChildByName(tf, "noticePeriod");
        push("Renewal Notice Period", noticeF && isExtracted(noticeF) ? getFormattedOrRaw(noticeF) : "");
        break;
      }
      case "ndaType": {
        const f = findChildByName(tf, "direction");
        push("NDA Type", f && isExtracted(f) ? getFormattedOrRaw(f) : "");
        break;
      }
      case "confidentialityObligationPeriod": {
        const f = findChildByName(tf, "duration");
        push("Duration of Confidentiality", f && isExtracted(f) ? getFormattedOrRaw(f) : "");
        break;
      }
      case "parties": {
        const partyEntries = getChildFields(tf);
        const names: string[] = [];
        const roles: string[] = [];

        for (const pf of partyEntries) {
          const dnF = findChildByName(pf, "displayName");
          const roleF = findChildByName(pf, "role");
          if (dnF && isExtracted(dnF)) names.push(getFormattedOrRaw(dnF));
          if (roleF && isExtracted(roleF)) {
            const rawRole = getDirectChildText(roleF, "Value");
            roles.push(formatRole(rawRole || getFormattedOrRaw(roleF)));
          }
        }

        push("Party Name", names.join("; "));
        push("Party Role (buyer/seller/etc.)", roles.join("; "));
        break;
      }
      case "languages": {
        const f = findChildByName(tf, "value");
        push("Languages", f && isExtracted(f) ? getFormattedOrRaw(f) : "");
        break;
      }
      default: {
        // Generic fallback: use the Label as field name and find the first extracted sub-field value
        const label = getDirectChildText(tf, "Label");
        if (label) {
          let val = "";
          for (const sf of getChildFields(tf)) {
            if (isExtracted(sf)) {
              val = getFormattedOrRaw(sf);
              if (val) break;
            }
          }
          if (val) push(label, val);
        }
        break;
      }
    }
  }

  return collected.map(({ name, value }) => {
    const category = getCategoryForField(name);
    return { originalName: name, value, category, isKnown: category !== "Other" };
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function parseXmlPayload(xmlString: string): { fields: ParsedField[]; error: string | null } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "text/xml");

    const parseError = doc.querySelector("parsererror");
    if (parseError) {
      return { fields: [], error: "Invalid XML format. Please check the syntax and try again." };
    }

    // Try the AIExtractions / RepeatableFieldCollections format first
    const aiFields = parseAIExtractionsFormat(doc);
    if (aiFields !== null) {
      if (aiFields.length === 0) {
        return { fields: [], error: "No extraction data found in the RepeatableFieldCollections section." };
      }
      return { fields: aiFields, error: null };
    }

    // --- Generic fallback strategies ---
    const results = new Map<string, ParsedField>();
    const addField = (name: string, value: string) => {
      const cleanName = name.trim();
      if (!cleanName) return;
      const key = cleanName.toLowerCase();
      if (!results.has(key)) {
        const category = getCategoryForField(cleanName);
        results.set(key, { originalName: cleanName, value: value.trim(), category, isKnown: category !== "Other" });
      }
    };

    // Strategy 1: <extraction name="..." value="..." />
    doc.querySelectorAll("extraction[name]").forEach(el => {
      const name = el.getAttribute("name");
      const value = el.getAttribute("value");
      if (name && value !== null) addField(name, value);
    });

    // Strategy 2: <field name="..."><value>...</value></field>
    doc.querySelectorAll("field[name]").forEach(el => {
      const name = el.getAttribute("name");
      const valueEl = el.querySelector("value");
      if (name && valueEl) addField(name, valueEl.textContent ?? "");
    });

    // Strategy 3: <item><name>...</name><value>...</value></item>
    doc.querySelectorAll("item").forEach(el => {
      const nameEl = el.querySelector("name");
      const valueEl = el.querySelector("value");
      if (nameEl && valueEl) addField(nameEl.textContent ?? "", valueEl.textContent ?? "");
    });

    if (results.size === 0) {
      return { fields: [], error: "No extracted fields found in the XML. Please ensure the format matches a supported structure." };
    }

    return { fields: Array.from(results.values()), error: null };
  } catch {
    return { fields: [], error: "An unexpected error occurred while parsing the XML." };
  }
}

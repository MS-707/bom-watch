/**
 * Claude AI Price Intelligence
 *
 * Uses Claude API with web_search to find distributor pricing
 * across DigiKey, Arrow, Newark, LCSC, and others.
 * Serves as the fallback when OEM Secrets is unavailable.
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY
 */

export interface ClaudeIntelResult {
  partNumber: string;
  bestPrice: number | null;
  bestSource: string | null;
  sourceUrl: string | null;
  insight: string;
  alternatives: Array<{
    distributor: string;
    price: number;
    url: string;
    note?: string;
  }>;
  searched: boolean;
}

// Detect whether a part number is mechanical (McMaster/industrial) or electronic
function isMechanicalPart(partNumber: string): boolean {
  const pn = partNumber.toUpperCase();
  if (/^MCM-/.test(pn)) return true;
  if (/^GRN-/.test(pn)) return true;
  // Pure numeric McMaster style (91251A544, 5234K57)
  if (/^\d{4,}[A-Z]\d+$/.test(pn)) return true;
  return false;
}

function buildPrompt(partNumber: string, description?: string): string {
  if (isMechanicalPart(partNumber)) {
    const descBlock = description
      ? `\nMcMaster product details: ${description}\nUse these specs to search — they are the key to finding the same part at other distributors.`
      : `\nIMPORTANT: McMaster part numbers are proprietary. Search by the DESCRIPTION of the part, not the McMaster catalog number.`;

    // Mechanical part — search industrial distributors
    return `Search for current pricing on McMaster-Carr part "${partNumber}" from ALTERNATIVE industrial distributors. I already have the McMaster price — I need alternatives.
${descBlock}

Search these specific sites for the same or equivalent part:
- grainger.com
- mscdirect.com (MSC Industrial)
- fastenal.com
- motionindustries.com
- zoro.com
- globalindustrial.com

Find the actual unit price (qty 1, USD) and product page URL from each distributor that stocks this part or an equivalent.

You MUST respond with ONLY a raw JSON object. No markdown, no backticks, no explanation. The JSON format:
{"bestPrice": 6.50, "bestSource": "Grainger", "sourceUrl": "https://www.grainger.com/product/...", "insight": "AI web search: Found equivalent at 3 distributors. Grainger and MSC stock this part at 15-20% less than McMaster.", "alternatives": [{"distributor": "Grainger", "price": 6.50, "url": "https://www.grainger.com/product/...", "note": "487 in stock"}, {"distributor": "MSC Industrial", "price": 7.10, "url": "https://www.mscdirect.com/product/...", "note": "In stock"}, {"distributor": "Fastenal", "price": 5.89, "url": "https://www.fastenal.com/product/...", "note": "Check local branch"}]}

Rules:
- USD prices only
- Include REAL product page URLs (not search result pages)
- bestSource = cheapest alternative distributor with stock
- Max 3 alternatives, each from a different distributor
- Start the insight with "AI web search:" so the user knows this is AI-sourced data
- If you can't find the exact part, search for equivalent specs and note the difference
- If no alternatives found, say so honestly — don't make up prices
- ALWAYS return valid JSON`;
  }

  // Electronic part — search electronics distributors
  return `Search for current pricing on "${partNumber}" from electronics distributors. Search these specific sites:
- digikey.com
- arrow.com
- newark.com
- lcsc.com
- findchips.com

Find the actual unit price (qty 1, USD) and product page URL from each distributor that stocks this part.

You MUST respond with ONLY a raw JSON object. No markdown, no backticks, no explanation. The JSON format:
{"bestPrice": 3.50, "bestSource": "LCSC", "sourceUrl": "https://lcsc.com/product-detail/STM32F103C8T6.html", "insight": "AI web search: Widely available from 5+ distributors", "alternatives": [{"distributor": "DigiKey", "price": 5.91, "url": "https://www.digikey.com/en/products/detail/stmicroelectronics/STM32F103C8T6/1646338", "note": "2782 in stock"}, {"distributor": "Arrow", "price": 4.28, "url": "https://www.arrow.com/en/products/stm32f103c8t6/stmicroelectronics", "note": "In stock"}]}

Rules:
- USD prices only, per unit qty 1
- Include REAL product page URLs (not search pages)
- bestSource = cheapest distributor with stock
- Max 3 alternatives, each from a different distributor
- Start the insight with "AI web search:" so the user knows this is AI-sourced data
- If you find the part on findchips.com or octopart.com, extract the distributor prices shown there
- If part is obsolete or unavailable, say so in insight and suggest a replacement part number
- If you can't verify a price, don't include it — only return prices you actually found
- ALWAYS return valid JSON`;
}

export async function claudeAnalyzePart(partNumber: string, description?: string): Promise<ClaudeIntelResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { partNumber, bestPrice: null, bestSource: null, sourceUrl: null, insight: '', alternatives: [], searched: false };
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        tools: [{
          type: 'web_search_20250305',
          name: 'web_search',
        }],
        messages: [{
          role: 'user',
          content: buildPrompt(partNumber, description),
        }],
      }),
    });

    if (!res.ok) {
      console.error(`[ClaudeIntel] API failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
      return { partNumber, bestPrice: null, bestSource: null, sourceUrl: null, insight: '', alternatives: [], searched: true };
    }

    const data = await res.json();

    // Extract text from Claude's response (may have tool use blocks before text)
    let responseText = '';
    for (const block of data.content || []) {
      if (block.type === 'text') {
        responseText += block.text;
      }
    }

    // Parse JSON from response — try to find the outermost JSON object
    // Strip markdown fences if present
    const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[ClaudeIntel] No JSON in response:', responseText.slice(0, 300));
      return { partNumber, bestPrice: null, bestSource: null, sourceUrl: null, insight: responseText.slice(0, 150), alternatives: [], searched: true };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      partNumber,
      bestPrice: typeof parsed.bestPrice === 'number' ? parsed.bestPrice : null,
      bestSource: parsed.bestSource || null,
      sourceUrl: parsed.sourceUrl || null,
      insight: parsed.insight || '',
      alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives.slice(0, 3).map((a: { distributor?: string; price?: number; url?: string; note?: string }) => ({
        distributor: a.distributor || 'Unknown',
        price: typeof a.price === 'number' ? a.price : 0,
        url: a.url || '',
        note: a.note || '',
      })) : [],
      searched: true,
    };
  } catch (err) {
    console.error(`[ClaudeIntel] Error analyzing "${partNumber}":`, err);
    return { partNumber, bestPrice: null, bestSource: null, sourceUrl: null, insight: '', alternatives: [], searched: true };
  }
}

/**
 * Analyze multiple parts in parallel.
 * Pass descriptions map so McMaster specs can be used for cross-referencing.
 */
export async function claudeAnalyzeParts(
  partNumbers: string[],
  descriptions?: Map<string, string>
): Promise<Map<string, ClaudeIntelResult>> {
  const results = new Map<string, ClaudeIntelResult>();

  const searches = await Promise.allSettled(
    partNumbers.map(async (pn) => {
      const desc = descriptions?.get(pn);
      const result = await claudeAnalyzePart(pn, desc);
      return { pn, result };
    })
  );

  for (const search of searches) {
    if (search.status === 'fulfilled') {
      results.set(search.value.pn, search.value.result);
    }
  }

  return results;
}

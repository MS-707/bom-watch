/**
 * Claude AI Price Intelligence
 * 
 * Uses Claude API with web_search tool to find the best price
 * for each part across the entire internet. Returns structured
 * pricing data with source links and AI insights.
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

export async function claudeAnalyzePart(partNumber: string): Promise<ClaudeIntelResult> {
  // Skip Claude pricing search when OEM Secrets is configured (it provides better data)
  if (process.env.OEMSECRETS_API_KEY) {
    return { partNumber, bestPrice: null, bestSource: null, sourceUrl: null, insight: '', alternatives: [], searched: false };
  }

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
          content: `You are a procurement pricing assistant. Search for current pricing on electronic/mechanical component "${partNumber}" from major distributors (DigiKey, Mouser, Arrow, Newark, LCSC, McMaster-Carr, Grainger, etc).

IMPORTANT: You MUST return a JSON object with pricing data. If web search results don't show exact prices, use your knowledge of typical distributor pricing for this component to provide your best estimate. Never say you can't find pricing — always provide your best data.

Return ONLY a valid JSON object (no markdown fences, no explanation before or after) in this exact format:
{"bestPrice": 3.50, "bestSource": "LCSC", "sourceUrl": "https://www.lcsc.com/product-detail/...", "insight": "One sentence about availability or alternatives", "alternatives": [{"distributor": "DigiKey", "price": 4.20, "url": "https://www.digikey.com/...", "note": "In stock"}, {"distributor": "Mouser", "price": 4.35, "url": "https://www.mouser.com/...", "note": "2500+ in stock"}]}

Rules:
- Prices in USD per unit for qty 1
- Max 3 alternatives
- If part is obsolete, set insight to explain and suggest a replacement
- Always include bestPrice and bestSource even if estimated
- Use real distributor URLs where possible`
        }],
      }),
    });

    if (!res.ok) {
      console.error(`[ClaudeIntel] API failed (${res.status}): ${await res.text()}`);
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

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[ClaudeIntel] No JSON in response:', responseText.slice(0, 200));
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
 * Analyze multiple parts in parallel. Claude API handles concurrent requests well.
 */
export async function claudeAnalyzeParts(partNumbers: string[]): Promise<Map<string, ClaudeIntelResult>> {
  const results = new Map<string, ClaudeIntelResult>();

  const searches = await Promise.allSettled(
    partNumbers.map(async (pn) => {
      const result = await claudeAnalyzePart(pn);
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

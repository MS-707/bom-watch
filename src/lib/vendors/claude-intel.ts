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
        'anthropic-version': '2024-01-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        tools: [{
          type: 'web_search',
          name: 'web_search',
        }],
        messages: [{
          role: 'user',
          content: `Find the best current price for electronic component "${partNumber}". Search distributor websites.

Return ONLY a JSON object (no markdown, no explanation) with this exact format:
{
  "bestPrice": 0.52,
  "bestSource": "Arrow",
  "sourceUrl": "https://www.arrow.com/...",
  "insight": "One sentence about availability, lead time, or substitutes",
  "alternatives": [
    {"distributor": "DigiKey", "price": 0.58, "url": "https://...", "note": "In stock"},
    {"distributor": "Mouser", "price": 0.62, "url": "https://...", "note": "2500+ in stock"}
  ]
}

If the part is obsolete, say so in the insight and suggest alternatives. Prices in USD. Max 3 alternatives.`
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

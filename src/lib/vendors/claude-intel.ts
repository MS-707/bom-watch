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
          content: `Search for current pricing on "${partNumber}" from electronics distributors. Search these specific sites:
- digikey.com
- arrow.com
- newark.com
- lcsc.com
- findchips.com

Find the actual unit price (qty 1, USD) and product page URL from each distributor that stocks this part.

You MUST respond with ONLY a raw JSON object. No markdown, no backticks, no explanation. The JSON format:
{"bestPrice": 3.50, "bestSource": "LCSC", "sourceUrl": "https://lcsc.com/product-detail/STM32F103C8T6.html", "insight": "Widely available from 5+ distributors", "alternatives": [{"distributor": "DigiKey", "price": 5.91, "url": "https://www.digikey.com/en/products/detail/stmicroelectronics/STM32F103C8T6/1646338", "note": "2782 in stock"}, {"distributor": "Arrow", "price": 4.28, "url": "https://www.arrow.com/en/products/stm32f103c8t6/stmicroelectronics", "note": "In stock"}]}

Rules:
- USD prices only, per unit qty 1
- Include REAL product page URLs (not search pages)
- bestSource = cheapest distributor with stock
- Max 3 alternatives, each from a different distributor
- If you find the part on findchips.com or octopart.com, extract the distributor prices shown there
- If part is obsolete or unavailable, say so in insight and suggest a replacement part number
- ALWAYS return valid JSON even if prices are estimated`
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

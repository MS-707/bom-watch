import { NextResponse } from 'next/server';

export const maxDuration = 30;

export async function GET() {
  const apiKey = process.env.OEMSECRETS_API_KEY;
  const testPart = 'STM32F103C8T6';

  if (!apiKey) {
    return NextResponse.json({ error: 'OEMSECRETS_API_KEY not set', keyLength: 0 });
  }

  try {
    const url = `https://oemsecretsapi.com/partsearch?searchTerm=${testPart}&apiKey=${apiKey}&countryCode=US&currency=USD`;
    const start = Date.now();
    const res = await fetch(url);
    const elapsed = Date.now() - start;

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({
        error: `API returned ${res.status}`,
        body: body.slice(0, 500),
        elapsed,
        keyPreview: apiKey.slice(0, 8) + '...',
      });
    }

    const data = await res.json();
    const stocks = data?.stock || [];

    return NextResponse.json({
      status: data?.status,
      parts_returned: data?.parts_returned,
      stockCount: stocks.length,
      elapsed,
      keyPreview: apiKey.slice(0, 8) + '...',
      firstDistributor: stocks[0]?.distributor?.distributor_name || null,
      firstPrice: stocks[0]?.prices?.USD?.[0]?.unit_price || null,
    });
  } catch (err) {
    return NextResponse.json({
      error: String(err),
      keyPreview: apiKey.slice(0, 8) + '...',
    });
  }
}

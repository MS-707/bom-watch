import { NextRequest, NextResponse } from 'next/server';

/**
 * BOM Analysis API
 * 
 * GET /api/boms — List analyzed BOMs with pricing data
 * Query params: ?status=analyzed|ordered&limit=20&offset=0
 * 
 * For hackathon: returns mock data
 * For production: reads from Vercel Postgres
 */

// Mock data — same structure the dashboard expects
// In production, this comes from the database populated by the webhook handler
const mockBoms = [
  {
    id: 'BOM-2847',
    name: 'Gripper Assembly v3.2',
    engineer: 'Sarah Chen',
    approvedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'analyzed',
    newParts: 5,
    totalSavings: 342.50,
    items: [
      { partNumber: 'MCM-91251A123', description: '18-8 SS Socket Head Cap Screw, M5 x 0.8mm, 20mm', qty: 24, mcmaster: 12.47, grainger: 9.85, digikey: null, mouser: null, bestVendor: 'Grainger', savings: 62.88 },
      { partNumber: 'MCM-5234K57', description: 'Aluminum 6061 Round Bar, 1" Dia x 12"', qty: 4, mcmaster: 28.90, grainger: 22.15, digikey: null, mouser: null, bestVendor: 'Grainger', savings: 27.00 },
      { partNumber: 'DK-1N4148W-FDICT', description: 'Diode Small Signal 100V 0.15A', qty: 50, mcmaster: null, grainger: null, digikey: 0.11, mouser: 0.09, bestVendor: 'Mouser', savings: 1.00 },
      { partNumber: 'MCM-6100K134', description: 'Linear Motion Shaft, 8mm Dia, 200mm', qty: 8, mcmaster: 18.75, grainger: 16.20, digikey: null, mouser: null, bestVendor: 'Grainger', savings: 20.40 },
      { partNumber: 'MCM-57155K371', description: 'Compression Spring, 0.5" OD x 1" L', qty: 16, mcmaster: 8.42, grainger: null, digikey: null, mouser: null, bestVendor: 'McMaster-Carr', savings: 0 },
    ]
  },
  {
    id: 'BOM-2843',
    name: 'Drive Motor Mount Rev B',
    engineer: 'James Park',
    approvedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: 'analyzed',
    newParts: 3,
    totalSavings: 156.20,
    items: [
      { partNumber: 'MCM-94180A351', description: '18-8 SS Flat Washer, M8', qty: 48, mcmaster: 5.63, grainger: 3.89, digikey: null, mouser: null, bestVendor: 'Grainger', savings: 83.52 },
      { partNumber: 'MCM-1346K43', description: 'Shaft Collar, 12mm Bore, 2-Piece', qty: 8, mcmaster: 14.25, grainger: 11.50, digikey: null, mouser: null, bestVendor: 'Grainger', savings: 22.00 },
      { partNumber: 'GRN-6YF81', description: 'Bearing, Ball, 6204-2RS', qty: 4, mcmaster: 24.17, grainger: 18.50, digikey: null, mouser: null, bestVendor: 'Grainger', savings: 22.68 },
    ]
  },
  {
    id: 'BOM-2839',
    name: 'Sensor Array Board v1.4',
    engineer: 'Lisa Wong',
    approvedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'ordered',
    newParts: 12,
    totalSavings: 89.40,
    items: []
  },
  {
    id: 'BOM-2835',
    name: 'Chassis Frame v2.1',
    engineer: 'Mike Torres',
    approvedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'ordered',
    newParts: 8,
    totalSavings: 215.80,
    items: []
  },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  let results = mockBoms;

  if (status && status !== 'all') {
    results = results.filter(b => b.status === status);
  }

  const paginated = results.slice(offset, offset + limit);

  // TODO: Set live: true when connected to real Arena PLM data
  const isLive = !!process.env.ARENA_API_KEY;

  return NextResponse.json({
    boms: paginated,
    total: results.length,
    limit,
    offset,
    live: isLive,
    stats: {
      totalSavingsMonth: parseFloat(results.reduce((sum, b) => sum + b.totalSavings, 0).toFixed(2)),
      bomsAnalyzed: results.length,
      avgSavingsPerBom: parseFloat((results.reduce((sum, b) => sum + b.totalSavings, 0) / results.length).toFixed(2)),
    }
  });
}

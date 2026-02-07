/**
 * Script to backfill Yahoo Finance symbols for all securities
 *
 * This script:
 * 1. Uses known ISIN -> Yahoo ticker mappings for accuracy
 * 2. Falls back to Yahoo Finance search API for unknown securities
 * 3. Validates each symbol returns valid quote data
 *
 * Usage: bun run packages/database/scripts/backfill-yahoo-symbols.ts
 */

import { prisma } from '../src/client.js';

// Known accurate ISIN -> Yahoo ticker mappings
// These have been manually verified to return correct prices
const KNOWN_MAPPINGS: Record<string, string> = {
  // German stocks
  DE000PAG9113: 'P911.DE', // Porsche AG
  DE0005810055: 'DB1.DE', // Deutsche Boerse
  // Spanish stocks
  ES0109067019: 'AMS.MC', // Amadeus IT
  ES0134950F36: 'FAE.MC', // Faes Farma
  ES0132105018: 'ACX.MC', // Acerinox
  ES0105148003: 'ATRY.MC', // Atrys Health
  // Danish stocks
  DK0062498333: 'NOVO-B.CO', // Novo Nordisk
  // Dutch stocks
  NL00150003E1: 'FUR.AS', // Fugro
  // ETFs - iShares Physical Metals (traded on LSE in USD)
  IE00B4ND3602: 'IGLN.L', // iShares Physical Gold ETC
  IE00B4NCWG09: 'ISLN.L', // iShares Physical Silver ETC
  IE0002PG6CA6: 'REMX.PA', // VanEck Rare Earth UCITS (Paris)
  JE00B1VS3002: 'PHPD.L', // WisdomTree Palladium
  JE00B1VS2W53: 'PHPT.L', // WisdomTree Platinum
  // US stocks
  US7170811035: 'PFE', // Pfizer
  US2372661015: 'DAR', // Darling Ingredients
  US6541061031: 'NKE', // Nike
  US7134481081: 'PEP', // PepsiCo
  US7672921050: 'RIOT', // Riot Platforms
  US67079K1007: 'SMR', // NuScale Power
  US76655K1034: 'RGTI', // Rigetti Computing
  US81758H1068: 'SERV', // Serve Robotics
  US30303M1027: 'META', // Meta Platforms
  US1729081059: 'CTAS', // Cintas
  US98980G1022: 'ZS', // Zscaler
  US09062X1037: 'BIIB', // Biogen
  US4525EP1011: 'IMUX', // Immunic Inc
  US8361001071: 'SOUN', // SoundHound AI
  US08862E1091: 'BYND', // Beyond Meat
  US01609W1027: 'BABA', // Alibaba ADR
  US0079031078: 'AMD', // AMD
  US02079K3059: 'GOOGL', // Alphabet Class A
  US0378331005: 'AAPL', // Apple
  US0937121079: 'BE', // Bloom Energy
  US2855121099: 'EA', // Electronic Arts
  US29355A1079: 'ENPH', // Enphase Energy
  US29414B1044: 'EPAM', // EPAM Systems
  US35671D8570: 'FCX', // Freeport-McMoRan
  US4128221086: 'HOG', // Harley-Davidson
  US4523271090: 'ILMN', // Illumina
  US45569U1016: 'INDI', // indie Semiconductor
  US46222L1089: 'IONQ', // IonQ
  US5128071082: 'LRCX', // Lam Research
  US5128073062: 'LRCX', // Lam Research (duplicate ISIN)
  US5951121038: 'MU', // Micron
  US60937P1066: 'MDB', // MongoDB
  US6516391066: 'NEM', // Newmont
  US72919P2020: 'PLUG', // Plug Power
  US7475251036: 'QCOM', // Qualcomm
  US7731211089: 'RKLB', // Rocket Lab
  US7731221062: 'RKLB', // Rocket Lab
  US83422N1054: 'SLDP', // Solid Power
  US8552441094: 'SBUX', // Starbucks
  US5834354095: 'STKH', // Steakholder Foods
  US86800U3023: 'SMCI', // Super Micro
  US86800U1043: 'SMCI', // Super Micro
  US88160R1014: 'TSLA', // Tesla
  US90353T1007: 'UBER', // Uber
  US9100471096: 'UAL', // United Airlines
  US91332U1016: 'U', // Unity
  US9831341071: 'WYNN', // Wynn Resorts
  // Canadian stocks that trade on US exchanges
  CA87261Y1060: 'TMC', // TMC The Metals Company (NASDAQ)
  CA67077M1086: 'NTR.TO', // Nutrien (TSX)
};

async function validateSymbol(yf: YahooFinance, symbol: string): Promise<boolean> {
  try {
    const quote = await yf.quote(symbol);
    return quote?.regularMarketPrice !== undefined;
  } catch {
    return false;
  }
}

async function searchAndValidate(yf: YahooFinance, query: string): Promise<string | null> {
  try {
    const result = await yf.search(query, { quotesCount: 5, newsCount: 0 });
    const quotes = result.quotes ?? [];

    // Prefer EQUITY type
    const equity = quotes.find((q) => q.quoteType === 'EQUITY' && q.symbol);
    const candidate = equity?.symbol || quotes[0]?.symbol;

    if (candidate) {
      const isValid = await validateSymbol(yf, candidate);
      if (isValid) return candidate;
    }
  } catch {
    // Ignore search errors
  }
  return null;
}

type YahooFinance = {
  quote(symbol: string): Promise<{ regularMarketPrice?: number } | null>;
  search(
    query: string,
    options: { quotesCount: number; newsCount: number },
  ): Promise<{
    quotes?: Array<{ symbol?: string; quoteType?: string }>;
  }>;
};

async function main() {
  console.log('🔍 Backfilling Yahoo symbols for all securities...\n');

  // Get all securities without yahooSymbol
  const securities = await prisma.security.findMany({
    where: { yahooSymbol: null },
  });

  if (securities.length === 0) {
    console.log('✅ All securities already have Yahoo symbols.');
    return;
  }

  console.log(`Found ${securities.length} securities without Yahoo symbols.\n`);

  // Import Yahoo Finance
  const YahooFinance = (
    await import('../../../apps/api/node_modules/yahoo-finance2/esm/src/index.js')
  ).default;
  const yf = new YahooFinance() as YahooFinance;

  let resolved = 0;
  let failed = 0;

  for (const security of securities) {
    const { id, isin, name, symbol } = security;

    // Strategy 1: Use known mapping
    if (isin && KNOWN_MAPPINGS[isin]) {
      const yahooSymbol = KNOWN_MAPPINGS[isin];
      await prisma.security.update({
        where: { id },
        data: { yahooSymbol },
      });
      console.log(`  ✅ ${isin} -> ${yahooSymbol} (known mapping)`);
      resolved++;
      continue;
    }

    // Strategy 2: Search by ISIN
    if (isin) {
      const found = await searchAndValidate(yf, isin);
      if (found) {
        await prisma.security.update({
          where: { id },
          data: { yahooSymbol: found },
        });
        console.log(`  ✅ ${isin} -> ${found} (ISIN search)`);
        resolved++;
        continue;
      }
    }

    // Strategy 3: Search by name
    const foundByName = await searchAndValidate(yf, name);
    if (foundByName) {
      await prisma.security.update({
        where: { id },
        data: { yahooSymbol: foundByName },
      });
      console.log(`  ✅ ${isin || symbol} -> ${foundByName} (name search: "${name}")`);
      resolved++;
      continue;
    }

    console.log(`  ❌ ${isin || symbol}: Could not resolve (${name})`);
    failed++;

    // Rate limiting delay
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Resolved: ${resolved}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total: ${securities.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

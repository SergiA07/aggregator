import YahooFinance from 'yahoo-finance2';
import { prisma } from '../src';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Symbol mappings
const SYMBOL_MAPPINGS: Record<string, string> = {
  DE000PAG9113: 'P911.DE',
  DE0005810055: 'DB1.DE',
  ES0109067019: 'AMS.MC',
  ES0134950F36: 'FAE.MC',
  ES0132105018: 'ACX.MC',
  ES0105148003: 'ATRY.MC',
  DK0062498333: 'NOVO-B.CO',
  NL00150003E1: 'FUR.AS',
  US7170811035: 'PFE',
  US2372661015: 'DAR',
  US6541061031: 'NKE',
  US7134481081: 'PEP',
  US7672921050: 'RIOT',
  US67079K1007: 'SMR',
  US76655K1034: 'RGTI',
  US81758H1068: 'SERV',
  US30303M1027: 'META',
  US1729081059: 'CTAS',
  US98980G1022: 'ZS',
  US09062X1037: 'BIIB',
  US4525EP1011: 'IMUX',
  US8361001071: 'SOUN',
  CA87261Y1060: 'TMC',
  CA67077M1086: 'NTR.TO',
};

// ETFs to fetch from justETF
const JUSTETF_ISINS = [
  'IE00B4ND3602',
  'IE00B4NCWG09',
  'IE0002PG6CA6',
  'JE00B1VS3002',
  'JE00B1VS2W53',
];
const JUSTETF_CURRENCY: Record<string, string> = {
  IE00B4ND3602: 'USD',
  IE00B4NCWG09: 'USD',
};

async function main() {
  // Get positions with securities
  const positions = await prisma.position.findMany({
    include: { security: true },
  });

  console.log(`Found ${positions.length} positions to update`);

  // Separate ETFs from stocks
  const etfPositions = positions.filter(
    (p) => p.security.isin && JUSTETF_ISINS.includes(p.security.isin),
  );
  const stockPositions = positions.filter(
    (p) => !p.security.isin || !JUSTETF_ISINS.includes(p.security.isin),
  );

  // Fetch ETF prices from justETF
  const etfQuotes = new Map<string, { price: number; currency: string }>();
  for (const pos of etfPositions) {
    const isin = pos.security.isin!;
    const currency = JUSTETF_CURRENCY[isin] || 'EUR';
    try {
      const response = await fetch(
        `https://www.justetf.com/api/etfs/${isin}/quote?locale=en&currency=${currency}`,
      );
      const data = await response.json();
      if (data.latestQuote?.raw) {
        etfQuotes.set(pos.securityId, { price: data.latestQuote.raw, currency });
        console.log(`justETF: ${pos.security.symbol} = ${data.latestQuote.raw} ${currency}`);
      }
    } catch (_e) {
      console.log(`Failed to fetch justETF for ${isin}`);
    }
    await new Promise((r) => setTimeout(r, 200)); // Rate limit
  }

  // Build Yahoo symbol list for stocks
  const yahooSymbols: string[] = [];
  const symbolToSecurityId = new Map<string, string>();
  for (const pos of stockPositions) {
    const isin = pos.security.isin;
    let symbol = pos.security.symbol;
    if (isin && SYMBOL_MAPPINGS[isin]) {
      symbol = SYMBOL_MAPPINGS[isin];
    } else if (isin?.startsWith('US')) {
      symbol = pos.security.symbol;
    } else if (isin?.startsWith('CA')) {
      symbol = `${pos.security.symbol}.TO`;
    }
    yahooSymbols.push(symbol);
    symbolToSecurityId.set(symbol, pos.securityId);
  }

  // Fetch Yahoo quotes
  const yahooQuotes = await yf.quote(yahooSymbols);
  const yahooMap = new Map<string, unknown>();
  for (const q of yahooQuotes) {
    yahooMap.set(q.symbol, q);
  }

  // Get FX rates
  const fxQuotes = await yf.quote(['USDEUR=X', 'DKKEUR=X', 'CADEUR=X']);
  const fxRates: Record<string, number> = { EUR: 1 };
  for (const q of fxQuotes) {
    const currency = q.symbol.replace('EUR=X', '');
    fxRates[currency] = q.regularMarketPrice || 1;
  }
  console.log(
    '\nFX Rates: USD=' +
      (fxRates.USD || 1).toFixed(4) +
      ', DKK=' +
      (fxRates.DKK || 1).toFixed(4) +
      ', CAD=' +
      (fxRates.CAD || 1).toFixed(4) +
      '\n',
  );

  // Update ETF positions
  for (const pos of etfPositions) {
    const quote = etfQuotes.get(pos.securityId);
    if (!quote) continue;

    let marketPrice = quote.price;
    // Convert if quote currency != position currency
    if (quote.currency !== pos.currency) {
      const fromRate = fxRates[quote.currency] || 1;
      const toRate = fxRates[pos.currency] || 1;
      marketPrice = quote.price * (fromRate / toRate);
    }

    const quantity = Number(pos.quantity);
    const marketValue = quantity * marketPrice;
    const totalCost = Number(pos.totalCost);
    const unrealizedPnl = marketValue - totalCost;

    await prisma.position.update({
      where: { id: pos.id },
      data: { marketPrice, marketValue, unrealizedPnl, updatedAt: new Date() },
    });
    console.log(
      'Updated ETF ' +
        pos.security.symbol +
        ': ' +
        marketPrice.toFixed(2) +
        ' ' +
        pos.currency +
        ' -> value ' +
        marketValue.toFixed(2),
    );
  }

  // Update stock positions
  for (const pos of stockPositions) {
    const isin = pos.security.isin;
    let yahooSymbol = pos.security.symbol;
    if (isin && SYMBOL_MAPPINGS[isin]) {
      yahooSymbol = SYMBOL_MAPPINGS[isin];
    } else if (isin?.startsWith('CA')) {
      yahooSymbol = `${pos.security.symbol}.TO`;
    }

    const quote = yahooMap.get(yahooSymbol);
    if (!quote?.regularMarketPrice) {
      console.log(`No quote for ${pos.security.symbol} (${yahooSymbol})`);
      continue;
    }

    let marketPrice = quote.regularMarketPrice;
    const quoteCurrency = quote.currency || pos.currency;

    // Convert if quote currency != position currency
    if (quoteCurrency !== pos.currency) {
      const fromRate = fxRates[quoteCurrency] || 1;
      const toRate = fxRates[pos.currency] || 1;
      marketPrice = quote.regularMarketPrice * (fromRate / toRate);
    }

    const quantity = Number(pos.quantity);
    const marketValue = quantity * marketPrice;
    const totalCost = Number(pos.totalCost);
    const unrealizedPnl = marketValue - totalCost;

    await prisma.position.update({
      where: { id: pos.id },
      data: { marketPrice, marketValue, unrealizedPnl, updatedAt: new Date() },
    });
    console.log(
      'Updated ' +
        pos.security.symbol +
        ': ' +
        marketPrice.toFixed(2) +
        ' ' +
        pos.currency +
        ' -> value ' +
        marketValue.toFixed(2),
    );
  }

  // Calculate total in EUR
  const updatedPositions = await prisma.position.findMany();
  let totalEur = 0;
  for (const pos of updatedPositions) {
    const fxRate = fxRates[pos.currency] || 1;
    totalEur += Number(pos.marketValue) * fxRate;
  }

  console.log(`\n=== TOTAL EUR VALUE: EUR ${totalEur.toFixed(2)} ===`);
  await prisma.$disconnect();
}

main().catch(console.error);

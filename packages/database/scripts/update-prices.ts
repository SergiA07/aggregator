/**
 * Script to update market prices for all positions
 *
 * Uses the yahooSymbol field from the Security table for lookups.
 * Run backfill-yahoo-symbols.ts first if securities don't have Yahoo symbols.
 *
 * Usage: bun run packages/database/scripts/update-prices.ts
 */

import { prisma } from '../src/client.js';

async function main() {
  console.log('🚀 Updating market prices for all positions...\n');

  // Get all positions with their securities
  const positions = await prisma.position.findMany({
    include: { security: true },
  });

  if (positions.length === 0) {
    console.log('No positions found.');
    return;
  }

  console.log(`Found ${positions.length} positions to update.\n`);

  // Build unique symbols list from Security.yahooSymbol
  const symbolMap = new Map<string, string>(); // securityId -> yahooSymbol
  const missingSymbols: string[] = [];

  for (const pos of positions) {
    const yahooSymbol = pos.security.yahooSymbol;
    if (yahooSymbol) {
      symbolMap.set(pos.securityId, yahooSymbol);
    } else {
      missingSymbols.push(pos.security.isin || pos.security.symbol);
    }
  }

  if (missingSymbols.length > 0) {
    console.log(`⚠️ ${missingSymbols.length} securities missing Yahoo symbols:`);
    console.log(`   ${missingSymbols.join(', ')}`);
    console.log('   Run: bun run packages/database/scripts/backfill-yahoo-symbols.ts\n');
  }

  const uniqueSymbols = [...new Set(symbolMap.values())];
  console.log(`Fetching quotes for ${uniqueSymbols.length} unique symbols...`);
  console.log(`Symbols: ${uniqueSymbols.join(', ')}\n`);

  // Dynamically import yahoo-finance2 from API package
  const YahooFinance = (
    await import('../../../apps/api/node_modules/yahoo-finance2/esm/src/index.js')
  ).default;
  const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

  // Fetch current exchange rates from Yahoo Finance
  const exchangeRates: Record<string, number> = { EUR: 1.0 };
  const fxPairs = [
    { pair: 'EURUSD=X', currency: 'USD' },
    { pair: 'EURDKK=X', currency: 'DKK' },
    { pair: 'EURCAD=X', currency: 'CAD' },
    { pair: 'EURGBP=X', currency: 'GBP' },
    { pair: 'EURCHF=X', currency: 'CHF' },
    { pair: 'EURHKD=X', currency: 'HKD' },
    { pair: 'EURAUD=X', currency: 'AUD' },
  ];

  console.log('Fetching current exchange rates...');
  for (const { pair, currency } of fxPairs) {
    try {
      const quote = await yf.quote(pair);
      if (quote?.regularMarketPrice) {
        // EURUSD=X gives EUR→USD rate, so 1 USD = 1/rate EUR
        exchangeRates[currency] = 1 / quote.regularMarketPrice;
        console.log(`  ${currency}: 1 ${currency} = €${exchangeRates[currency].toFixed(4)}`);
      }
    } catch {
      console.log(`  ⚠️ ${currency}: Failed to fetch rate, using fallback`);
    }
  }
  // GBX (pence) is 1/100 of GBP
  exchangeRates.GBX = (exchangeRates.GBP || 1.15) / 100;
  console.log(`  GBX: 1 GBX = €${exchangeRates.GBX.toFixed(6)} (derived from GBP)\n`);

  // Fetch quotes with currency info
  const quotes = new Map<string, { price: number; currency: string }>();
  let successCount = 0;
  let failCount = 0;

  for (const symbol of uniqueSymbols) {
    try {
      const quote = await yf.quote(symbol);
      if (quote?.regularMarketPrice) {
        const currency = quote.currency || 'USD';
        quotes.set(symbol, { price: quote.regularMarketPrice, currency });
        console.log(`  ✅ ${symbol}: ${quote.regularMarketPrice} ${currency}`);
        successCount++;
      } else {
        console.log(`  ⚠️  ${symbol}: No price data`);
        failCount++;
      }
    } catch (err) {
      console.log(`  ❌ ${symbol}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      failCount++;
    }
    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nQuotes fetched: ${successCount} success, ${failCount} failed\n`);

  // Update positions with currency conversion to EUR
  let updated = 0;
  for (const position of positions) {
    const yahooSymbol = symbolMap.get(position.securityId);
    if (!yahooSymbol) continue;

    const quoteData = quotes.get(yahooSymbol);
    if (!quoteData) continue;

    const { price, currency } = quoteData;
    const quantity = Number(position.quantity);

    // Convert market value to EUR
    const fxRate = exchangeRates[currency] ?? 1.0;
    const marketValueNative = quantity * price;
    const marketValueEur = marketValueNative * fxRate;

    const totalCost = Number(position.totalCost); // Already in EUR from DeGiro
    const unrealizedPnl = marketValueEur - totalCost;

    await prisma.position.update({
      where: { id: position.id },
      data: {
        marketPrice: price, // Store native currency price
        marketValue: marketValueEur, // Store EUR value
        unrealizedPnl: unrealizedPnl,
        updatedAt: new Date(),
      },
    });

    const currencySymbol = currency === 'EUR' ? '€' : currency;
    console.log(
      `  📊 ${position.security.yahooSymbol}: qty=${quantity}, price=${price.toFixed(2)} ${currencySymbol}, value=€${marketValueEur.toFixed(2)}, P&L=€${unrealizedPnl.toFixed(2)}`,
    );
    updated++;
  }

  console.log(`\n✅ Updated ${updated}/${positions.length} positions with market prices.`);

  // Show summary
  const summary = await prisma.position.aggregate({
    _sum: {
      totalCost: true,
      marketValue: true,
      unrealizedPnl: true,
    },
  });

  console.log('\n📈 Portfolio Summary:');
  console.log(`   Total Cost:      €${Number(summary._sum.totalCost || 0).toFixed(2)}`);
  console.log(`   Market Value:    €${Number(summary._sum.marketValue || 0).toFixed(2)}`);
  console.log(`   Unrealized P&L:  €${Number(summary._sum.unrealizedPnl || 0).toFixed(2)}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

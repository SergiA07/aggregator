import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import type { SecurityType } from '../../domain/entities';

/**
 * OpenFIGI API response types
 * @see https://www.openfigi.com/api/documentation
 */
interface OpenFigiJob {
  idType: 'ID_ISIN' | 'ID_CUSIP' | 'ID_SEDOL' | 'TICKER';
  idValue: string;
  exchCode?: string;
  micCode?: string;
}

interface OpenFigiResult {
  figi: string;
  securityType: string;
  securityType2?: string;
  marketSector: string;
  ticker: string;
  name: string;
  exchCode: string;
  compositeFIGI?: string;
  shareClassFIGI?: string;
}

interface OpenFigiResponse {
  data?: OpenFigiResult[];
  error?: string;
}

/**
 * OpenFIGI Client Service
 *
 * Free API for mapping ISINs to security metadata including type.
 * Rate limits:
 * - Without API key: 25 requests/minute, max 10 jobs/request
 * - With API key: 25 requests/6 seconds, max 100 jobs/request
 *
 * This service implements rate limiting to handle large batches:
 * - Processes up to 25 requests (250 ISINs) per minute
 * - Automatically adds delays when exceeding the rate limit
 *
 * @see https://www.openfigi.com/api
 */
@Injectable()
export class OpenFigiService {
  private readonly API_URL = 'https://api.openfigi.com/v3/mapping';
  private readonly MAX_JOBS_PER_REQUEST = 10; // Free tier limit
  private readonly MAX_REQUESTS_PER_MINUTE = 25; // Free tier rate limit
  private readonly RATE_LIMIT_DELAY_MS = 60_000; // 1 minute delay when rate limited
  private readonly REQUEST_TIMEOUT_MS = 10_000; // 10 second timeout per request
  private readonly MAX_RETRIES = 3; // Max retries for rate-limited requests

  constructor(@InjectPinoLogger(OpenFigiService.name) private readonly logger: PinoLogger) {}

  /**
   * Look up security type by ISIN
   * Returns null if lookup fails or ISIN not found
   */
  async getSecurityType(isin: string): Promise<SecurityType | null> {
    const results = await this.lookupByIsin([isin]);
    return results.get(isin) || null;
  }

  /**
   * Batch lookup security types by ISINs
   * Returns a Map of ISIN -> SecurityType
   *
   * Handles rate limiting automatically:
   * - Processes up to 250 ISINs (25 requests) per minute
   * - For larger batches, adds 1-minute delays between rate limit windows
   */
  async lookupByIsin(isins: string[]): Promise<Map<string, SecurityType>> {
    const results = new Map<string, SecurityType>();

    if (isins.length === 0) return results;

    // Process in batches to respect rate limits
    const batches = this.chunkArray(isins, this.MAX_JOBS_PER_REQUEST);
    const totalBatches = batches.length;

    // Log if we'll need rate limiting
    if (totalBatches > this.MAX_REQUESTS_PER_MINUTE) {
      const estimatedMinutes = Math.ceil(totalBatches / this.MAX_REQUESTS_PER_MINUTE);
      this.logger.info(
        { totalIsins: isins.length, totalBatches, estimatedMinutes },
        'Large OpenFIGI lookup - will process with rate limiting',
      );
    }

    let requestsInCurrentWindow = 0;
    let retryCount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      // Check if we need to wait for rate limit reset
      if (requestsInCurrentWindow >= this.MAX_REQUESTS_PER_MINUTE) {
        this.logger.info(
          { processedBatches: i, remainingBatches: totalBatches - i },
          'Rate limit reached, waiting 1 minute before continuing',
        );
        await this.delay(this.RATE_LIMIT_DELAY_MS);
        requestsInCurrentWindow = 0;
      }

      try {
        const batchResults = await this.fetchBatch(batch);
        for (const [isin, type] of batchResults) {
          results.set(isin, type);
        }
        requestsInCurrentWindow++;
        retryCount = 0; // Reset retry count on success
      } catch (error) {
        // Handle 429 Too Many Requests specifically
        if (error instanceof Error && error.message.includes('429')) {
          retryCount++;
          if (retryCount > this.MAX_RETRIES) {
            this.logger.error(
              { batchIndex: i, retryCount },
              'OpenFIGI max retries exceeded, skipping remaining batches',
            );
            break;
          }
          this.logger.warn(
            { retryCount, maxRetries: this.MAX_RETRIES },
            'Rate limited by OpenFIGI, waiting 1 minute before retry',
          );
          await this.delay(this.RATE_LIMIT_DELAY_MS);
          requestsInCurrentWindow = 0;
          i--; // Retry the batch
          continue;
        }

        this.logger.warn(
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            batchSize: batch.length,
            batchIndex: i,
          },
          'OpenFIGI batch lookup failed',
        );
      }
    }

    this.logger.debug(
      { totalIsins: isins.length, successfulLookups: results.size },
      'OpenFIGI lookup completed',
    );

    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async fetchBatch(isins: string[]): Promise<Map<string, SecurityType>> {
    const results = new Map<string, SecurityType>();

    const jobs: OpenFigiJob[] = isins.map((isin) => ({
      idType: 'ID_ISIN',
      idValue: isin.toUpperCase(),
    }));

    const response = await fetch(this.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/json',
      },
      body: JSON.stringify(jobs),
      signal: AbortSignal.timeout(this.REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`OpenFIGI API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OpenFigiResponse[];

    // Response is array matching input order
    let matchCount = 0;
    let noMatchCount = 0;

    for (let i = 0; i < data.length; i++) {
      const isin = isins[i];
      const result = data[i];

      if (result.data && result.data.length > 0) {
        const securityType = this.mapSecurityType(result.data[0].securityType);
        results.set(isin, securityType);
        matchCount++;
      } else if (result.error) {
        noMatchCount++;
      }
    }

    this.logger.debug(
      { batchSize: isins.length, matchCount, noMatchCount },
      'OpenFIGI batch completed',
    );

    return results;
  }

  /**
   * Map OpenFIGI security types to our SecurityType enum
   */
  private mapSecurityType(openFigiType: string): SecurityType {
    const type = openFigiType.toLowerCase();

    // ETFs and ETPs
    if (type.includes('etp') || type.includes('etf') || type === 'open-end fund') {
      return 'etf';
    }

    // Bonds and fixed income
    if (
      type.includes('bond') ||
      type.includes('note') ||
      type.includes('bill') ||
      type.includes('debenture') ||
      type === 'govt'
    ) {
      return 'bond';
    }

    // Mutual funds
    if (type.includes('fund') || type.includes('unit') || type === 'mutual fund') {
      return 'fund';
    }

    // Crypto (rare in OpenFIGI but possible)
    if (type.includes('crypto') || type.includes('digital')) {
      return 'crypto';
    }

    // Common stocks
    if (
      type === 'common stock' ||
      type === 'depositary receipt' ||
      type === 'adr' ||
      type === 'reit' ||
      type === 'equity'
    ) {
      return 'stock';
    }

    // Default to stock for unknown types
    return 'stock';
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

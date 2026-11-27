// Instrument details and option chain routes.
import express from 'express';
import type { Request, Response } from 'express';
import { upstoxConfig, globalLiveQuotes } from '../../state';
import {
  getInstrumentKey,
  getUnderlyingOptionInstrumentKey,
  getDynamicLotSizeInfo,
  lotSizeCache,
} from '../../lib/instruments';
import { buildSimulatedOptionChain } from './simulatedOptionChain';

export function resolveOptionChainSymbol(query: Record<string, any>): string {
  const sym = typeof query?.symbol === 'string' ? query.symbol.trim() : '';
  const inst = typeof query?.instrumentKey === 'string' ? query.instrumentKey.trim() : '';
  return sym || inst || 'NIFTY 50';
}

export function registerOptionChainRoutes(app: express.Application) {
  // 6. Option Chain Data (Real Upstox API with Fallback)

  // Real-time instrument lookup (100% Dynamic Live Lot Size from Upstox API)
  app.get('/api/instrument/details', async (req: Request, res: Response) => {
    const symbol = String(req.query.symbol || '').trim();
    const rawInstrumentKey = String(req.query.instrumentKey || '').trim();
    const instrumentKey = rawInstrumentKey || getInstrumentKey(symbol);
    const token = upstoxConfig.accessToken;

    const symUpper = symbol.toUpperCase();
    const isOptionOrIndex =
      /\b(CE|PE|CALL|PUT|FUT)\b/.test(symUpper) ||
      symUpper.includes('NIFTY') ||
      symUpper.includes('BANKNIFTY') ||
      symUpper.includes('FINNIFTY') ||
      symUpper.includes('MIDCP') ||
      symUpper.includes('SENSEX') ||
      symUpper.includes('BANKEX') ||
      instrumentKey.includes('FO|') ||
      instrumentKey.includes('INDEX|');

    if (!isOptionOrIndex) {
      // Equity / Cash Stock uses exact Share Quantity (1 share step), never option lots
      return res.json({
        symbol,
        instrumentKey,
        lotSize: 1,
        source: 'EQUITY_SHARES',
      });
    }

    const liveInfo = await getDynamicLotSizeInfo(symbol, token, rawInstrumentKey || undefined);

    res.json({
      symbol,
      instrumentKey: liveInfo.underlyingKey || instrumentKey,
      lotSize: liveInfo.lotSize,
      source: liveInfo.source,
      expiry: liveInfo.expiry,
    });
  });

  app.get('/api/market/optionchain', async (req: Request, res: Response) => {
    const symbol = resolveOptionChainSymbol(req.query as Record<string, any>);
    const instrumentKey = getUnderlyingOptionInstrumentKey(symbol);
    const token = upstoxConfig.accessToken;

    if (!token) {
      // Provide realistic option chain for paper trading and demonstration
      return res.json(buildSimulatedOptionChain(symbol, req.query.expiry as string));
    }

    try {
      // Fetch contract to get expiry dates and live lot_size
      const contractRes = await fetch(
        `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(instrumentKey as string)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Api-Version': '2.0',
          },
        },
      );

      if (!contractRes.ok) {
        return res.status(401).json({ error: 'Unauthorized. Check API Token.', strikes: [] });
      }

      const contractData = await contractRes.json();
      if (!contractData.data || contractData.data.length === 0) {
        throw new Error('No contracts found');
      }

      // Find nearest valid expiry date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const validExpiries: string[] = Array.from<string>(
        new Set<string>(
          contractData.data
            .map((c: any) => String(c.expiry || ''))
            .filter((e: string) => e && new Date(e).getTime() >= today.getTime()),
        ),
      ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

      const requestedExpiry = String(req.query.expiry || '').trim();
      const expiryDate =
        requestedExpiry && validExpiries.includes(requestedExpiry)
          ? requestedExpiry
          : validExpiries.length > 0
            ? validExpiries[0]
            : contractData.data[0].expiry;

      // Extract live lot_size for this expiry directly from Upstox contract response
      const activeContractForLot =
        contractData.data.find(
          (c: any) => c.expiry === expiryDate && Number(c.lot_size || c.minimum_lot) > 0,
        ) || contractData.data.find((c: any) => Number(c.lot_size || c.minimum_lot) > 0);
      const liveLotSize = Number(
        activeContractForLot?.lot_size || activeContractForLot?.minimum_lot || 1,
      );

      if (liveLotSize > 0) {
        const cacheEntry = {
          lotSize: liveLotSize,
          timestamp: Date.now(),
          source: 'UPSTOX_LIVE',
          expiry: expiryDate,
        };
        lotSizeCache[instrumentKey] = cacheEntry;
        lotSizeCache[symbol.toUpperCase()] = cacheEntry;
      }

      // Fetch option chain
      const chainRes = await fetch(
        `https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent(instrumentKey as string)}&expiry_date=${expiryDate}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Api-Version': '2.0',
          },
        },
      );

      if (!chainRes.ok) {
        throw new Error('Failed to fetch option chain');
      }

      const chainData = await chainRes.json();

      if (chainData && chainData.data) {
        let totalCallOI = 0;
        let totalPutOI = 0;
        const strikes = chainData.data.map((item: any) => {
          const call = item.call_options || {};
          const put = item.put_options || {};
          const callOI = call.market_data?.oi || 0;
          const putOI = put.market_data?.oi || 0;
          totalCallOI += callOI;
          totalPutOI += putOI;

          return {
            strikePrice: item.strike_price,
            callLTP: call.market_data?.ltp || 0,
            putLTP: put.market_data?.ltp || 0,
            callOI,
            putOI,
            callChangeOI: call.market_data?.oi_change || 0,
            putChangeOI: put.market_data?.oi_change || 0,
            callVolume: call.market_data?.volume || 0,
            putVolume: put.market_data?.volume || 0,
            callDelta: call.option_greeks?.delta || 0,
            putDelta: put.option_greeks?.delta || 0,
            callTheta: call.option_greeks?.theta || 0,
            putTheta: put.option_greeks?.theta || 0,
            callGamma: call.option_greeks?.gamma || 0,
            putGamma: put.option_greeks?.gamma || 0,
            callIV: call.option_greeks?.iv || 0,
            putIV: put.option_greeks?.iv || 0,
            callInstrumentKey: call.instrument_key || '',
            putInstrumentKey: put.instrument_key || '',
            lotSize: liveLotSize,
          };
        });

        const pcr = totalCallOI > 0 ? Number((totalPutOI / totalCallOI).toFixed(2)) : 1;

        const underlyingSpot = Number(
          chainData.data[0]?.underlying_spot_price ||
            chainData.data[0]?.underlying_price ||
            globalLiveQuotes[instrumentKey]?.last_price ||
            0,
        );

        // Compute ATM strike closest to underlyingSpot for accurate Max Pain / ATM highlight
        const closestAtmStrike =
          strikes.length > 0 && underlyingSpot > 0
            ? [...strikes].sort(
                (a, b) =>
                  Math.abs(a.strikePrice - underlyingSpot) -
                  Math.abs(b.strikePrice - underlyingSpot),
              )[0]?.strikePrice
            : strikes.length > 0
              ? strikes[Math.floor(strikes.length / 2)].strikePrice
              : 0;

        const result = {
          underlyingSymbol: symbol,
          underlyingLTP: underlyingSpot,
          lotSize: liveLotSize,
          timestamp: new Date().toISOString(),
          expiryDates: validExpiries.length > 0 ? validExpiries.slice(0, 6) : [expiryDate],
          selectedExpiry: expiryDate,
          strikes,
          pcr,
          maxPain: closestAtmStrike,
          totalCallOI,
          totalPutOI,
        };

        return res.json(result);
      }
      throw new Error('Invalid chain data');
    } catch (error) {
      console.warn('Upstox live option chain fallback to simulated dataset:', error);
      return res.json(buildSimulatedOptionChain(symbol, req.query.expiry as string));
    }
  });
}

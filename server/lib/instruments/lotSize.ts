// Lot-size discovery with a 15-minute cache backed by the Upstox option contract API.
import { resilientFetchJson } from '../http';
import { getUnderlyingOptionInstrumentKey, lotSizeCache } from './instrumentKeys';

export const getDynamicLotSizeInfo = async (
  symbol: string,
  token: string,
  specificInstrumentKey?: string,
): Promise<{
  lotSize: number;
  source: 'UPSTOX_LIVE' | 'CACHED_UPSTOX_LIVE' | 'TOKEN_REQUIRED';
  expiry?: string;
  underlyingKey: string;
}> => {
  const underlyingKey = getUnderlyingOptionInstrumentKey(symbol || specificInstrumentKey || '');
  const cacheKey =
    specificInstrumentKey && specificInstrumentKey.includes('FO|')
      ? specificInstrumentKey
      : underlyingKey;

  const now = Date.now();
  const cached = lotSizeCache[cacheKey] || lotSizeCache[underlyingKey];
  if (cached && cached.lotSize > 0 && now - cached.timestamp < 15 * 60 * 1000) {
    return {
      lotSize: cached.lotSize,
      source: 'CACHED_UPSTOX_LIVE',
      expiry: cached.expiry,
      underlyingKey,
    };
  }

  if (token) {
    try {
      const contractData: any = await resilientFetchJson(
        `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(underlyingKey)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Api-Version': '2.0',
          },
        },
        2,
        5000,
      );
      if (Array.isArray(contractData?.data) && contractData.data.length > 0) {
        let matchedContract = specificInstrumentKey
          ? contractData.data.find((c: any) => c.instrument_key === specificInstrumentKey)
          : null;

        if (!matchedContract) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const upcomingContracts = contractData.data
            .filter(
              (c: any) =>
                c.expiry &&
                new Date(c.expiry).getTime() >= today.getTime() &&
                Number(c.lot_size || c.minimum_lot) > 0,
            )
            .sort((a: any, b: any) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime());
          matchedContract =
            upcomingContracts.length > 0 ? upcomingContracts[0] : contractData.data[0];
        }

        const liveLotSize = Number(matchedContract?.lot_size || matchedContract?.minimum_lot || 0);
        if (liveLotSize > 0) {
          const entry = {
            lotSize: liveLotSize,
            timestamp: now,
            source: 'UPSTOX_LIVE',
            expiry: matchedContract?.expiry,
          };
          lotSizeCache[underlyingKey] = entry;
          lotSizeCache[cacheKey] = entry;
          if (symbol) lotSizeCache[symbol.toUpperCase()] = entry;
          return {
            lotSize: liveLotSize,
            source: 'UPSTOX_LIVE',
            expiry: matchedContract?.expiry,
            underlyingKey,
          };
        }
      }
    } catch {
      // Network failure falls through to cache/default lot size.
    }
  }

  if (cached && cached.lotSize > 0) {
    return {
      lotSize: cached.lotSize,
      source: 'CACHED_UPSTOX_LIVE',
      expiry: cached.expiry,
      underlyingKey,
    };
  }

  const symUp = (symbol || specificInstrumentKey || underlyingKey || '').toUpperCase();
  let defaultLot = 1;
  if (symUp.includes('MIDCP') || symUp.includes('MID SELECT') || symUp.includes('MIDCAP'))
    defaultLot = 120;
  else if (symUp.includes('FINNIFTY') || symUp.includes('FIN SERVICE')) defaultLot = 60;
  else if (symUp.includes('BANKNIFTY') || symUp.includes('NIFTY BANK') || symUp === 'BANK')
    defaultLot = 30;
  else if (symUp.includes('BANKEX')) defaultLot = 30;
  else if (symUp.includes('SENSEX')) defaultLot = 20;
  else if (symUp.includes('NIFTY')) defaultLot = 65;

  return {
    lotSize: defaultLot,
    source: 'TOKEN_REQUIRED',
    underlyingKey,
  };
};

export const getDynamicLotSize = async (
  symbol: string,
  token: string,
  specificInstrumentKey?: string,
): Promise<number> => {
  const info = await getDynamicLotSizeInfo(symbol, token, specificInstrumentKey);
  return info.lotSize;
};

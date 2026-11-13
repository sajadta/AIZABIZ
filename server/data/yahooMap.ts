// Static Yahoo Finance symbol map used for NSE/BSE/MCX/GLOBAL quote fallbacks.
export const YAHOO_NSE_MAP: {
  symbol: string;
  name: string;
  instrumentKey: string;
  yahooTicker: string;
  exchange: "NSE" | "BSE" | "NFO" | "MCX" | "GLOBAL";
  segment: "INDEX" | "EQUITY" | "FUTURES" | "COMMODITY" | "GLOBAL";
}[] = [
  { symbol: "NIFTY 50", name: "Nifty 50 Index", instrumentKey: "NSE_INDEX|Nifty 50", yahooTicker: "^NSEI", exchange: "NSE", segment: "INDEX" },
  { symbol: "BANKNIFTY", name: "Nifty Bank Index", instrumentKey: "NSE_INDEX|Nifty Bank", yahooTicker: "^NSEBANK", exchange: "NSE", segment: "INDEX" },
  { symbol: "NIFTY FUT", name: "Nifty Index Futures", instrumentKey: "NSE_FO|NIFTY24NOVFUT", yahooTicker: "^NSEI", exchange: "NFO", segment: "FUTURES" },
  { symbol: "BANKNIFTY FUT", name: "Bank Nifty Futures", instrumentKey: "NSE_FO|BANKNIFTY24NOVFUT", yahooTicker: "^NSEBANK", exchange: "NFO", segment: "FUTURES" },
  { symbol: "SENSEX", name: "BSE SENSEX Index", instrumentKey: "BSE_INDEX|SENSEX", yahooTicker: "^BSESN", exchange: "BSE", segment: "INDEX" },
  { symbol: "FINNIFTY", name: "Nifty Fin Service", instrumentKey: "NSE_INDEX|Nifty Fin Service", yahooTicker: "NIFTY_FIN_SERVICE.NS", exchange: "NSE", segment: "INDEX" },
  { symbol: "MIDCPNIFTY", name: "Nifty Midcap Select", instrumentKey: "NSE_INDEX|NIFTY MID SELECT", yahooTicker: "NIFTY_MID_SELECT.NS", exchange: "NSE", segment: "INDEX" },
  { symbol: "BANKEX", name: "BSE BANKEX Index", instrumentKey: "BSE_INDEX|BANKEX", yahooTicker: "^BSEBANK", exchange: "BSE", segment: "INDEX" },
  { symbol: "CRUDEOIL FUT", name: "MCX Crude Oil Futures", instrumentKey: "MCX_FO|CRUDEOIL24NOVFUT", yahooTicker: "CL=F", exchange: "MCX", segment: "COMMODITY" },
  { symbol: "NATURALGAS", name: "MCX Natural Gas Futures", instrumentKey: "MCX_FO|NATURALGAS24NOVFUT", yahooTicker: "NG=F", exchange: "MCX", segment: "COMMODITY" },
  { symbol: "GOLD", name: "MCX Gold Futures", instrumentKey: "MCX_FO|GOLD24NOVFUT", yahooTicker: "GC=F", exchange: "MCX", segment: "COMMODITY" },
  { symbol: "SILVER", name: "MCX Silver Futures", instrumentKey: "MCX_FO|SILVER24NOVFUT", yahooTicker: "SI=F", exchange: "MCX", segment: "COMMODITY" },
  { symbol: "S&P 500", name: "S&P 500 Index", instrumentKey: "GLOBAL_INDEX|US500", yahooTicker: "^GSPC", exchange: "GLOBAL", segment: "GLOBAL" },
  { symbol: "NASDAQ 100", name: "Nasdaq 100 Index", instrumentKey: "GLOBAL_INDEX|NDX", yahooTicker: "^IXIC", exchange: "GLOBAL", segment: "GLOBAL" },
  { symbol: "RELIANCE", name: "Reliance Industries Ltd", instrumentKey: "NSE_EQ|INE002A01018", yahooTicker: "RELIANCE.NS", exchange: "NSE", segment: "EQUITY" },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd", instrumentKey: "NSE_EQ|INE040A01034", yahooTicker: "HDFCBANK.NS", exchange: "NSE", segment: "EQUITY" },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd", instrumentKey: "NSE_EQ|INE090A01021", yahooTicker: "ICICIBANK.NS", exchange: "NSE", segment: "EQUITY" },
  { symbol: "TCS", name: "Tata Consultancy Services", instrumentKey: "NSE_EQ|INE467B01029", yahooTicker: "TCS.NS", exchange: "NSE", segment: "EQUITY" },
  { symbol: "INFY", name: "Infosys Ltd", instrumentKey: "NSE_EQ|INE009A01021", yahooTicker: "INFY.NS", exchange: "NSE", segment: "EQUITY" },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd", instrumentKey: "NSE_EQ|INE155A01022", yahooTicker: "TATAMOTORS.NS", exchange: "NSE", segment: "EQUITY" },
  { symbol: "SBIN", name: "State Bank of India", instrumentKey: "NSE_EQ|INE062A01020", yahooTicker: "SBIN.NS", exchange: "NSE", segment: "EQUITY" },
  { symbol: "AXISBANK", name: "Axis Bank Ltd", instrumentKey: "NSE_EQ|INE238A01034", yahooTicker: "AXISBANK.NS", exchange: "NSE", segment: "EQUITY" },
];

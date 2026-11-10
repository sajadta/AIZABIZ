import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  LineChart,
  BarChart2,
  Cpu,
  Layers,
  Briefcase,
  Sparkles,
  PieChart,
  Activity,
  Smartphone,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  StockQuote,
  CandleData,
  TradingSignal,
  Order,
  Position,
  Holding,
  BotConfig,
  BotLog,
  UpstoxApiConfig,
  GeminiMarketAnalysis,
  OptionChainData,
  Language,
  ExecutionMode,
  PriceAlert,
  OrderTransactionType,
} from './types';
import { safeStorage } from './utils/storage';
import { translations } from './translations';
import { Header } from './components/Header';

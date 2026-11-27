import type {
  OrderTransactionType,
  OrderType,
  ProductType,
  Language,
  ExecutionMode,
} from '../../types';

export interface LiveUpstoxCharges {
  total: number;
  brokerage: number;
  source: string;
  isLiveUpstox: boolean;
}

export interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  instrumentKey?: string;
  defaultPrice: number;
  initialType: OrderTransactionType;
  defaultQuantity?: number;
  defaultLotSize?: number;
  defaultProductType?: ProductType;
  heldQuantity?: number;
  defaultStopLoss?: number;
  defaultTarget?: number;
  availableMargin?: number;
  maxCapitalPerTrade?: number;
  mode: ExecutionMode;
  onPlaceOrder: (orderData: {
    symbol: string;
    instrumentKey?: string;
    transactionType: OrderTransactionType;
    orderType: OrderType;
    productType: ProductType;
    quantity: number;
    price: number;
    triggerPrice?: number;
    stopLoss?: number;
    target?: number;
    is_amo?: boolean;
  }) => void;
  language: Language;
}

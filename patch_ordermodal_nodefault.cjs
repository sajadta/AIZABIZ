const fs = require('fs');
let code = fs.readFileSync('src/components/OrderModal.tsx', 'utf8');

const oldState = `  const [lotSize, setLotSize] = useState<number>(() => {
    if (symbol.includes('FIN SERVICE') || symbol.includes('FINNIFTY')) return 65;
    if (symbol.includes('BANK')) return 15;
    if (symbol.includes('NIFTY')) return 25;
    if (symbol.includes('SENSEX')) return 10;
    return 1;
  });
  const [quantity, setQuantity] = useState<number>(lotSize);

  useEffect(() => {
    const fetchInstrumentDetails = async () => {
      try {
        const res = await fetch(\`/api/instrument/details?symbol=\${encodeURIComponent(symbol)}\`);
        if (res.ok) {
           const data = await res.json();
           if (data.lotSize) {
              setLotSize(data.lotSize);
              // Only update quantity if it hasn't been changed by user yet or is same as old lotSize
              setQuantity(prev => (prev === 25 || prev === 65 || prev === 15 || prev === 10 || prev === 1) ? data.lotSize : prev);
           }
        }
      } catch (e) {
        // Fallback already set
      }
    };
    fetchInstrumentDetails();
  }, [symbol]);`;

const newState = `  const [lotSize, setLotSize] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(0);
  const [isLoadingLot, setIsLoadingLot] = useState<boolean>(true);

  useEffect(() => {
    const fetchInstrumentDetails = async () => {
      setIsLoadingLot(true);
      try {
        const res = await fetch(\`/api/instrument/details?symbol=\${encodeURIComponent(symbol)}\`);
        if (res.ok) {
           const data = await res.json();
           if (data.lotSize) {
              setLotSize(data.lotSize);
              setQuantity(data.lotSize);
           }
        }
      } catch (e) {
        // Fallback for extreme cases
        setLotSize(1);
        setQuantity(1);
      } finally {
        setIsLoadingLot(false);
      }
    };
    fetchInstrumentDetails();
  }, [symbol]);`;

code = code.replace(oldState, newState);

const submitButton = `<button
            type="submit"
            className={\`w-full py-3 rounded-lg font-bold text-white shadow-lg transition-colors \${
              transactionType === 'BUY'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'
                : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20'
            }\`}
          >`;

const newSubmitButton = `<button
            type="submit"
            disabled={isLoadingLot || quantity === 0}
            className={\`w-full py-3 rounded-lg font-bold text-white shadow-lg transition-colors \${
              transactionType === 'BUY'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20 disabled:opacity-50 disabled:bg-emerald-800'
                : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20 disabled:opacity-50 disabled:bg-rose-800'
            }\`}
          >`;

code = code.replace(submitButton, newSubmitButton);

const placeOrderText = `{transactionType === 'BUY' ? t.quickBuy : t.quickSell}`;
const newPlaceOrderText = `{isLoadingLot ? 'Fetching Lot Size...' : transactionType === 'BUY' ? t.quickBuy : t.quickSell}`;

code = code.replace(placeOrderText, newPlaceOrderText);

fs.writeFileSync('src/components/OrderModal.tsx', code);
console.log('Patched OrderModal to remove default');

const fs = require('fs');
let code = fs.readFileSync('src/components/OrderModal.tsx', 'utf8');

const targetStr = `  initialType: OrderTransactionType;
  mode: ExecutionMode;`;

const replaceStr = `  initialType: OrderTransactionType;
  defaultStopLoss?: number;
  defaultTarget?: number;
  mode: ExecutionMode;`;

code = code.replace(targetStr, replaceStr);

const targetStr2 = `  initialType,
  mode,
  onPlaceOrder,`;

const replaceStr2 = `  initialType,
  defaultStopLoss,
  defaultTarget,
  mode,
  onPlaceOrder,`;

code = code.replace(targetStr2, replaceStr2);

const targetStr3 = `  useEffect(() => {
     setPrice(defaultPrice || 100);
     setTriggerPrice(Number(((defaultPrice || 0) * 0.99).toFixed(2)));
     
     // More sensible default for options vs index
     const slRatio = defaultPrice < 1000 ? 0.8 : 0.985;
     const tgtRatio = defaultPrice < 1000 ? 1.5 : 1.025;
     
     setStopLoss(Number(((defaultPrice || 0) * slRatio).toFixed(2)));
     setTarget(Number(((defaultPrice || 0) * tgtRatio).toFixed(2)));
     setTransactionType(initialType || 'BUY');
  }, [defaultPrice, initialType]);`;

const replaceStr3 = `  useEffect(() => {
     setPrice(defaultPrice || 100);
     setTriggerPrice(Number(((defaultPrice || 0) * 0.99).toFixed(2)));
     
     // More sensible default for options vs index
     const slRatio = defaultPrice < 1000 ? 0.8 : 0.985;
     const tgtRatio = defaultPrice < 1000 ? 1.5 : 1.025;
     
     setStopLoss(defaultStopLoss !== undefined ? defaultStopLoss : Number(((defaultPrice || 0) * slRatio).toFixed(2)));
     setTarget(defaultTarget !== undefined ? defaultTarget : Number(((defaultPrice || 0) * tgtRatio).toFixed(2)));
     setTransactionType(initialType || 'BUY');
  }, [defaultPrice, initialType, defaultStopLoss, defaultTarget]);`;

code = code.replace(targetStr3, replaceStr3);

fs.writeFileSync('src/components/OrderModal.tsx', code);
console.log("Patched OrderModal.tsx props");

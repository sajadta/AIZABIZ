const fs = require('fs');
let code = fs.readFileSync('src/components/OrderModal.tsx', 'utf8');

const targetStr = `  const [price, setPrice] = useState<number>(defaultPrice || 100);
  const [triggerPrice, setTriggerPrice] = useState<number>(Number(((defaultPrice || 0) * 0.99).toFixed(2)));
  const [stopLoss, setStopLoss] = useState<number>(Number(((defaultPrice || 0) * 0.985).toFixed(2)));
  const [target, setTarget] = useState<number>(Number(((defaultPrice || 0) * 1.025).toFixed(2)));`;

const replaceStr = `  const [price, setPrice] = useState<number>(defaultPrice || 100);
  const [triggerPrice, setTriggerPrice] = useState<number>(Number(((defaultPrice || 0) * 0.99).toFixed(2)));
  const [stopLoss, setStopLoss] = useState<number>(Number(((defaultPrice || 0) * 0.985).toFixed(2)));
  const [target, setTarget] = useState<number>(Number(((defaultPrice || 0) * 1.025).toFixed(2)));

  useEffect(() => {
     setPrice(defaultPrice || 100);
     setTriggerPrice(Number(((defaultPrice || 0) * 0.99).toFixed(2)));
     
     // More sensible default for options vs index
     const slRatio = defaultPrice < 1000 ? 0.8 : 0.985;
     const tgtRatio = defaultPrice < 1000 ? 1.5 : 1.025;
     
     setStopLoss(Number(((defaultPrice || 0) * slRatio).toFixed(2)));
     setTarget(Number(((defaultPrice || 0) * tgtRatio).toFixed(2)));
     setTransactionType(initialType || 'BUY');
  }, [defaultPrice, initialType]);`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/components/OrderModal.tsx', code);
console.log("Patched OrderModal.tsx state reset");

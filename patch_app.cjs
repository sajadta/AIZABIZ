const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `  // Open Order Modal Helper
  const openOrderModal = (type: OrderTransactionType, sym: string, prc: number) => {
    setOrderModalData({
      symbol: sym,
      price: prc,
      initialType: type,
    });
    setOrderModalOpen(true);
  };`;

const replaceStr = `  // Open Order Modal Helper
  const openOrderModal = (type: OrderTransactionType, sym: string, prc: number, sl?: number, tgt?: number) => {
    setOrderModalData({
      symbol: sym,
      price: prc,
      initialType: type,
      stopLoss: sl,
      target: tgt
    } as any);
    setOrderModalOpen(true);
  };`;

code = code.replace(targetStr, replaceStr);

const targetStr2 = `              onExecuteSignal={(sig) => openOrderModal(sig.signalType as OrderTransactionType, sig.symbol, sig.price)}`;
const replaceStr2 = `              onExecuteSignal={(sig) => openOrderModal(sig.signalType as OrderTransactionType, sig.symbol, sig.price, sig.stopLoss, sig.target1)}`;

code = code.replace(targetStr2, replaceStr2);

const targetStr3 = `              symbol={orderModalData.symbol}
              defaultPrice={orderModalData.price}
              initialType={orderModalData.initialType}`;
const replaceStr3 = `              symbol={orderModalData.symbol}
              defaultPrice={orderModalData.price}
              initialType={orderModalData.initialType}
              defaultStopLoss={(orderModalData as any).stopLoss}
              defaultTarget={(orderModalData as any).target}`;

code = code.replace(targetStr3, replaceStr3);

fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx with default stopLoss and target");

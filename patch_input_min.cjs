const fs = require('fs');
let code = fs.readFileSync('src/components/OrderModal.tsx', 'utf8');

const oldInput = `<input
                  type="number"
                  min="1"
                  step={lotStep}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}`;

const newInput = `<input
                  type="number"
                  min={lotStep || 1}
                  step={lotStep || 1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}`;

code = code.replace(oldInput, newInput);
fs.writeFileSync('src/components/OrderModal.tsx', code);
console.log('Patched input min step');

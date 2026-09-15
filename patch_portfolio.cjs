const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
const search = `              </div>
            </div>

            {/* Holdings */}`;
const replace = `              </div>
            </div>

            {/* Cumulative PnL Chart */}
            <CumulativePnLChart tradeHistory={tradeHistory} language={language} />

            {/* Holdings */}`;
code = code.replace(search, replace);
fs.writeFileSync('src/App.tsx', code);

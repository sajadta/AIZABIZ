const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Add import
code = code.replace(/import \{ CumulativePnLChart \} from "\.\/components\/CumulativePnLChart";/, 'import { CumulativePnLChart } from "./components/CumulativePnLChart";\nimport { AlertsModal } from "./components/AlertsModal";');

// Add state
code = code.replace(/const \[isApiModalOpen, setIsApiModalOpen\] = useState\(false\);/, 'const [isApiModalOpen, setIsApiModalOpen] = useState(false);\n  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);');

// Pass to Header
code = code.replace(/dailyProfit=\{dailyProfit\}/, 'dailyProfit={dailyProfit}\n          onOpenAlerts={() => setIsAlertsModalOpen(true)}');

// Render modal
const renderModal = `
      {isAlertsModalOpen && (
        <AlertsModal
          onClose={() => setIsAlertsModalOpen(false)}
          priceAlerts={priceAlerts}
          onAddAlert={handleAddAlert}
          onRemoveAlert={handleRemoveAlert}
          language={language}
        />
      )}`;

code = code.replace(/\{isApiModalOpen && \(/, renderModal + '\n\n      {isApiModalOpen && (');

fs.writeFileSync('src/App.tsx', code);

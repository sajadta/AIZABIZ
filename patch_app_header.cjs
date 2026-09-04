const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const regex = /<Header[\s\S]*?apiConfig=\{apiConfig\}\s*\/>/;

const newHeader = `<Header 
          mode={mode} 
          setMode={setMode} 
          language={language} 
          setLanguage={setLanguage}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          onOpenApiSettings={() => setIsApiModalOpen(true)}
          onOpenAndroidModal={() => setIsAndroidModalOpen(true)}
          apiConfig={apiConfig}
          isWsConnected={isWsConnected}
          activePositionsCount={enrichedPositions.length}
          onSquareOffAll={handleSquareOffAll}
          totalPnL={totalPnL}
          dailyProfit={tradeHistory.reduce((a, b) => a + (b.realizedPnL || 0) - 40, 0)}
        />`;

if (regex.test(code)) {
    code = code.replace(regex, newHeader);
    fs.writeFileSync('src/App.tsx', code);
    console.log("Patched Header call in App.tsx");
} else {
    console.log("Regex didn't match.");
}

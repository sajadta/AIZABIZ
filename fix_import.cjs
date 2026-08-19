const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const importStatement = `import { LiveAiSupport } from './components/LiveAiSupport';\n`;

if (!code.includes('LiveAiSupport } from')) {
    code = code.replace(
        "import { \n  AndroidInstallModal \n} from './components/AndroidInstallModal';",
        "import { \n  AndroidInstallModal \n} from './components/AndroidInstallModal';\n" + importStatement
    );
    fs.writeFileSync('src/App.tsx', code);
}

const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldChat = `  } catch (err: any)  {
    return res.status(500) .json({ success: false, error: err.message });
  }`;
const newChat = `  } catch (err: any)  {
    if (err.message && err.message.includes('quota')) {
       return res.json({ success: true, text: 'ക്ഷമിക്കണം, നിലവിൽ സിസ്റ്റത്തിൽ കൂടുതൽ തിരക്കുള്ളതിനാൽ (API Quota Exceeded) AI ഡയഗ്നോസ്റ്റിക്സ് ഇപ്പോൾ ലഭ്യമായിരിക്കില്ല. ദയവായി കുറച്ചു കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക. അൽഗോരിതം കോഡുകൾ സാധാരണഗതിയിൽ പ്രവർത്തിക്കുന്നുണ്ട് എന്ന് ഉറപ്പുവരുത്തിയിട്ടുണ്ട്.' });
    }
    return res.status(500) .json({ success: false, error: err.message });
  }`;

code = code.replace(oldChat, newChat);
fs.writeFileSync('server.ts', code);
console.log('Patched chat fallback');

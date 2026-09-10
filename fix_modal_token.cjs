const fs = require('fs');
let code = fs.readFileSync('src/components/UpstoxApiModal.tsx', 'utf8');

code = code.replace(
  'const handleDailyTokenSubmit = async (e: React.FormEvent) => {',
  'const handleDailyTokenSubmit = async (e: React.FormEvent) => {\n    e.preventDefault();\n    let cleanToken = accessToken?.trim() || "";\n    if (cleanToken.startsWith("Bearer ")) cleanToken = cleanToken.replace("Bearer ", "").trim();\n'
);

code = code.replace(
  /body: JSON\.stringify\(\{ accessToken: accessToken\?\.trim\(\) \}\)/g,
  'body: JSON.stringify({ accessToken: cleanToken })'
);

code = code.replace(
  /accessToken: accessToken\?\.trim\(\),/g,
  'accessToken: cleanToken,'
);

code = code.replace(
  /localStorage\.setItem\('upstox_daily_token', accessToken\?\.trim\(\)\);/g,
  "localStorage.setItem('upstox_daily_token', cleanToken);"
);

// Close modal on success after 1 second
code = code.replace(
  /setStatusMsg\(\{\n\s*type: 'success',[\s\S]*?\}\);/g,
  `$&
        setTimeout(() => {
          onClose();
        }, 1500);`
);

// Remove the e.preventDefault() that might be duplicated now
code = code.replace(
  'const handleDailyTokenSubmit = async (e: React.FormEvent) => {\n    e.preventDefault();\n    let cleanToken = accessToken?.trim() || "";\n    if (cleanToken.startsWith("Bearer ")) cleanToken = cleanToken.replace("Bearer ", "").trim();\n\n    e.preventDefault();',
  'const handleDailyTokenSubmit = async (e: React.FormEvent) => {\n    e.preventDefault();\n    let cleanToken = accessToken?.trim() || "";\n    if (cleanToken.startsWith("Bearer ")) cleanToken = cleanToken.replace("Bearer ", "").trim();\n'
);


fs.writeFileSync('src/components/UpstoxApiModal.tsx', code);

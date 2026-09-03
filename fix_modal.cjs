const fs = require('fs');
let modal = fs.readFileSync('src/components/UpstoxApiModal.tsx', 'utf-8');

modal = modal.replace(
`  useEffect(() => {
    setApiKey(config.apiKey);
    setApiSecret(config.apiSecret);
    setAccessToken(config.accessToken || '');
    if (config.redirectUri) setRedirectUri(config.redirectUri);
  }, [config, isOpen]);`,
`  useEffect(() => {
    if (isOpen) {
      setApiKey(config.apiKey || '');
      setApiSecret(config.apiSecret || '');
      setAccessToken(config.accessToken || '');
      if (config.redirectUri) setRedirectUri(config.redirectUri);
    }
  }, [isOpen]);`
);

fs.writeFileSync('src/components/UpstoxApiModal.tsx', modal);
console.log("Patched modal.");

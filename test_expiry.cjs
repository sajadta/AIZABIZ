require('dotenv').config();

(async () => {
   const token = process.env.UPSTOX_ACCESS_TOKEN;
   if (!token) return console.log("no token");
   const res = await fetch(`https://api.upstox.com/v2/option/contract?instrument_key=NSE_INDEX|Nifty%20Bank`, {
       headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
   });
   const data = await res.json();
   if (data && data.data) {
       console.log(data.data.map(d => d.expiry).slice(0, 10));
   }
})();

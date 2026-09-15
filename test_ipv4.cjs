const { setGlobalDispatcher, Agent } = require('undici');
setGlobalDispatcher(new Agent({ connect: { family: 4 } }));

const token = "eyJhbGciOiJSUzI1NiIsImtpZCI6ImFwaS1nYXRld2F5LWp3dC1rZXkifQ...";
fetch("https://api.upstox.com/v2/user/profile", {
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Api-Version": "2.0",
  },
}).then(res => res.json()).then(data => console.log(data)).catch(err => console.error(err));

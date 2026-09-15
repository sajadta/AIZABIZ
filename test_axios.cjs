const axios = require('axios');
const http = require('http');
const https = require('https');
const axiosInstance = axios.create({
  httpAgent: new http.Agent({ family: 4 }),
  httpsAgent: new https.Agent({ family: 4 })
});
axiosInstance.get('https://api.upstox.com/v2/user/profile', {
  headers: { 'Api-Version': '2.0', 'Accept': 'application/json', 'Authorization': 'Bearer test' }
}).then(res => console.log(res.status)).catch(err => console.log(err.response ? err.response.status : err.message));

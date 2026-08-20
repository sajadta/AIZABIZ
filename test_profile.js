fetch('http://localhost:3000/api/upstox/daily-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: 'test-invalid-token' })
}).then(res => res.json()).then(console.log).catch(console.error);

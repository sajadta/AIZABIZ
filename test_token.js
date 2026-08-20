fetch('https://api.upstox.com/v2/user/profile', {
    headers: {
        'Authorization': `Bearer DUMMY`,
        'Accept': 'application/json',
    }
}).then(res => res.json()).then(console.log).catch(console.error);

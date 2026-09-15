const token = "eyJhbGciOiJSUzI1NiIsImtpZCI6ImFwaS1nYXRld2F5LWp3dC1rZXkifQ.eyJ1c2VyX2lkIjoiM1lXUjFMTGMyTldFNEpEaXJkRjI1SWpiWFpzQ2hKNEJtY1lZWEZYRkx5UjZ2QXB6VjU2THhCbmlKNHdaTUp3N21nIiwiY2xpZW50X2lkIjoiY21uN3B4MjZ1b2QzODc1NzZmaXAwMDJjN2ciLCJpYXQiOjE3MDcxNjY4NTgsImV4cCI6MTcwNzI1MzI1OH0.YXZh...";
fetch("https://api.upstox.com/v2/user/profile", {
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Api-Version": "2.0",
  },
}).then(res => res.json()).then(data => console.log(data)).catch(err => console.error(err));

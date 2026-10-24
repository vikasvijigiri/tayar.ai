const fs = require('fs');
const app = fs.readFileSync('App.tsx', 'utf8');
if (!app.includes('lastFiveAccuracy')) throw new Error('Missing recent accuracy metric');
if (!app.includes('SOURCE-VERIFIED')) throw new Error('Missing source integrity guard');
if (!app.includes('https://tayar-ai-api.onrender.com')) throw new Error('Missing configured API base URL');
if (!app.includes('/health')) throw new Error('Missing backend health check integration');
if (!app.includes('Service unavailable')) throw new Error('Missing offline/error state');
console.log('Mobile source smoke tests passed: dashboard metrics, source integrity, API URL and connectivity states');

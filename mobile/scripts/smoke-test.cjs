const fs = require('fs');
const app = fs.readFileSync('App.tsx', 'utf8');
if (!app.includes('lastFiveAccuracy')) throw new Error('Missing recent accuracy metric');
if (!app.includes('source-verified')) throw new Error('Missing source integrity guard');
console.log('Mobile source smoke tests passed');
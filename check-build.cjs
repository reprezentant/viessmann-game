const fs = require('fs');
const txt = fs.readFileSync('dist/assets/index-CiWP2vht.js', 'utf8');
console.log('DEV-UPDATED', txt.includes('DEV-UPDATED'));
console.log('role="group"', txt.includes('role="group"'));
console.log('seasonInfoMap', txt.includes('seasonInfoMap'));
console.log('Wiosna', txt.includes('Wiosna'));

const fs = require('fs');
const txt = fs.readFileSync('dist/assets/index-CiWP2vht.js', 'utf8');
console.log('role:"group" present?', txt.includes('role:"group"'));

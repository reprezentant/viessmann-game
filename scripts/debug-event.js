const fs = require('fs');
const path = require('path');
const file = path.resolve(__dirname, '..', 'src', 'ViessmannGame.tsx');
const source = fs.readFileSync(file, 'utf8');
const matches = [];
let idx = 0;
while (idx < source.length) {
  const next = source.indexOf('Event', idx);
  if (next === -1) break;
  matches.push(next);
  idx = next + 1;
}
console.log('occurrences of "Event":', matches.length);
for (const pos of matches.slice(0, 5)) {
  const snippet = source.slice(Math.max(0, pos - 10), pos + 20);
  console.log('snippet around', pos, ':');
  console.log(snippet);
  console.log(Array.from(snippet).map(ch => ch.charCodeAt(0)));
}

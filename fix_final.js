const fs = require('fs'); 
let lines = fs.readFileSync('public/tv.html', 'utf8').split('\n'); 

let firstSkip = lines.findIndex((l, i) => i > 4700 && i < 4900 && l.includes("document.getElementById('btn-debug-skip-song')")); 
if (firstSkip !== -1) { 
  lines.splice(firstSkip, 8); 
} 

let secondSkip = lines.findIndex((l, i) => i > 5000 && l.includes("document.getElementById('btn-debug-skip-song')")); 
if (secondSkip !== -1) { 
  lines[secondSkip+3] = '});\n</script>\n\n<!-- D-Pad Navigation & Jackbox Button Events -->'; 
  lines.splice(secondSkip+4, 1); 
} 

fs.writeFileSync('public/tv.html', lines.join('\n')); 
console.log('Fixed final');

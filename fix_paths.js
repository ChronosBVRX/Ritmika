const fs = require('fs');
const files = ['public/tv.html', 'public/mobile.html', 'public/js/animations.js'];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let txt = fs.readFileSync(f, 'utf8');
    let original = txt;
    
    // Reemplaza /assets/ por ./assets/ en href, src, url(), y backticks
    txt = txt.replace(/href="\/assets\//g, 'href="./assets/');
    txt = txt.replace(/src="\/assets\//g, 'src="./assets/');
    txt = txt.replace(/url\(\/assets\//g, 'url(./assets/');
    txt = txt.replace(/`\/assets\//g, '`./assets/');
    txt = txt.replace(/'\/assets\//g, '\'./assets/');
    
    if (txt !== original) {
      fs.writeFileSync(f, txt);
      console.log(f + ' updated.');
    } else {
      console.log(f + ' no changes.');
    }
  }
});

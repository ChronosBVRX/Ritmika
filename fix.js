const fs = require('fs');

let tv = fs.readFileSync('public/tv.html', 'utf8');
let hook = fs.readFileSync('fix_hook.txt', 'utf8').trim();
let replacement = fs.readFileSync('fix_text.txt', 'utf8');

if (tv.includes(hook)) {
  tv = tv.replace(hook, replacement);
  
  // Now replace the card logic
  const newCardLogic = "let awardGraphic = award.img ? '<img src=\"'+award.img+'\" style=\"width:160px;height:160px;object-fit:contain;margin:0 auto 12px;filter:drop-shadow(0 0 18px '+award.color+');\"/>' : '<div style=\"font-size:76px;margin-bottom:8px;filter:drop-shadow(0 0 18px '+award.color+');\">'+award.icon+'</div>';\n      aCard.innerHTML= awardGraphic \n        +'<h2 style=\"font-family:\\'Paytone One\\',sans-serif;font-size:42px;margin:6px 0;text-shadow:0 0 22px '+award.color+';color:'+award.color+';\">'+award.title+'</h2>'\n        +'<p style=\"font-family:Fredoka,sans-serif;font-size:15px;color:#94a3b8;font-weight:700;margin-bottom:16px;letter-spacing:2px;text-transform:uppercase;\">'+award.subtitle+'</p>'";
  
  let regex = /aCard\.innerHTML='<div style="font-size:76px;margin-bottom:8px;filter:drop-shadow\(0 0 18px '\+award\.color\+'\);\">'\+award\.icon\+'<\/div>'\s*\+'<h2 style="font-family:\\'Paytone One\\',sans-serif;font-size:42px;margin:6px 0;text-shadow:0 0 22px '\+award\.color\+';color:'\+award\.color\+';\">'\+award\.title\+'<\/h2>'\s*\+'<p style="font-family:Fredoka,sans-serif;font-size:15px;color:#94a3b8;font-weight:700;margin-bottom:16px;letter-spacing:2px;text-transform:uppercase;">'\+award\.subtitle\+'<\/p>'/;
  if (regex.test(tv)) {
      tv = tv.replace(regex, newCardLogic);
      fs.writeFileSync('public/tv.html', tv, 'utf8');
      console.log('Fixed via regex!');
  } else {
      fs.writeFileSync('public/tv.html', tv, 'utf8');
      console.log('Fixed hook, but could not find card logic at all.');
  }
} else {
  console.log('Hook not found.');
}

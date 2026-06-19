const fs = require('fs');
let content = fs.readFileSync('public/tv.html', 'utf8');

// replace await wait(2000);
content = content.replace(
    "axoloSay('&#161;Lleg&#243; el momento que todos esperaban! Despu&#233;s de tres rondas, canciones, tomatazos, y mucha carrilla... ha llegado la hora de coronar al Rey del Palenque. El ganador de R&#237;tmika es...', 'podium_winner_buildup.mp3');\n      await wait(2000);",
    "axoloSay('&#161;Lleg&#243; el momento que todos esperaban! Despu&#233;s de tres rondas, canciones, tomatazos, y mucha carrilla... ha llegado la hora de coronar al Rey del Palenque. El ganador de R&#237;tmika es...', 'podium_winner_buildup.mp3');\n      await wait(3000);"
);

// replace await wait(4000);
content = content.replace(
    "anime({targets:'#susp-text',opacity:[0,1],translateY:[20,0],duration:600,easing:'easeOutQuad'});\n      await wait(4000);",
    "anime({targets:'#susp-text',opacity:[0,1],translateY:[20,0],duration:600,easing:'easeOutQuad'});\n      await wait(7000);"
);

// replace await wait(15000);
content = content.replace(
    "      });\n      await wait(15000);\n      anime({targets:'#winner-reveal-content'",
    "      });\n      await wait(18000);\n      anime({targets:'#winner-reveal-content'"
);

fs.writeFileSync('public/tv.html', content, 'utf8');
console.log('done');

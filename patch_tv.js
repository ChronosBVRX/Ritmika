const fs = require('fs');
let txt = fs.readFileSync('public/tv.html', 'utf8');

const target1 = `    if (banner) banner.classList.add('show');
    
    setTimeout(() => {`;

const repl1 = `    if (banner) banner.classList.add('show');
    
    const startBtn = document.createElement('button');
    startBtn.className = 'jb-yellow font-paytone text-3xl px-12 py-4 mt-8 mx-auto block jb-card';
    startBtn.style.cursor = 'pointer';
    startBtn.style.position = 'relative';
    startBtn.style.zIndex = '9999';
    startBtn.textContent = '▶ INICIAR EL SHOW';
    startBtn.onclick = () => {
      startBtn.remove();
      if (banner) banner.classList.remove('show');
      if (typeof bootMusic !== 'undefined' && bootMusic) bootMusic.play().catch(()=>{});
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(()=>{});
      }

      setTimeout(() => {`;

const target2 = `        wipeContainer.remove();
      }

    }, 1200);
  },
  fail(n, msg) {`;

const repl2 = `        wipeContainer.remove();
      }

      }, 120);
    }; // end onclick
    const bootContent = document.querySelector('.boot-content');
    if (bootContent) bootContent.appendChild(startBtn);
  },
  fail(n, msg) {`;

if (txt.includes(target1) && txt.includes(target2)) {
  txt = txt.replace(target1, repl1);
  txt = txt.replace(target2, repl2);
  fs.writeFileSync('public/tv.html', txt);
  console.log('Modifications applied successfully.');
} else {
  console.log('Could not find target strings.');
}

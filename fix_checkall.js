const fs = require('fs');
let lines = fs.readFileSync('public/tv.html', 'utf8').split('\n');

const startIdx = lines.findIndex((l, i) => i >= 2005 && l.includes('setTimeout(() => {'));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes('fail(n, msg) {'));

if (startIdx !== -1 && endIdx !== -1) {
  const newCode = `    const startBtn = document.createElement('button');
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

      setTimeout(() => {
        // ══════════════════════════════════════════════
        // JACKBOX-STYLE WIPE TRANSITION
        // ══════════════════════════════════════════════
        if (bootMusic && !bootMusic.paused) {
          const fadeSteps = 30;
          const fadeInterval = 50;
          const volStep = bootMusic.volume / fadeSteps;
          let step = 0;
          const fadeOut = setInterval(() => {
            step++;
            bootMusic.volume = Math.max(0, bootMusic.volume - volStep);
            if (step >= fadeSteps) {
              clearInterval(fadeOut);
              bootMusic.pause();
              bootMusic.volume = 0.4;
            }
          }, fadeInterval);
        }

        const wipeContainer = document.createElement('div');
        wipeContainer.style.cssText = 'position:fixed;inset:0;z-index:999999;pointer-events:none;overflow:hidden;display:flex;';
        
        const leftWipe = document.createElement('div');
        leftWipe.style.cssText = 'position:absolute;top:0;left:-70%;width:70%;height:100%;background:#00e5ff;transform:skewX(12deg);border-right:15px solid #111827;box-shadow:20px 0 0 #111827;';
        
        const rightWipe = document.createElement('div');
        rightWipe.style.cssText = 'position:absolute;top:0;right:-70%;width:70%;height:100%;background:#ec4899;transform:skewX(12deg);border-left:15px solid #111827;box-shadow:-20px 0 0 #111827;';
        
        const centerLogo = document.createElement('div');
        centerLogo.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(0);font-family:"Paytone One",sans-serif;font-size:7rem;color:#ffe600;text-shadow:8px 8px 0 #111827, 0 0 40px rgba(0,0,0,0.8);z-index:10;white-space:nowrap;letter-spacing:4px;';
        centerLogo.textContent = '¡A JUGAR!';

        wipeContainer.appendChild(leftWipe);
        wipeContainer.appendChild(rightWipe);
        wipeContainer.appendChild(centerLogo);
        document.body.appendChild(wipeContainer);

        try { if(typeof UISounds !== 'undefined') UISounds.whoosh(); } catch(e){}

        if (typeof anime !== 'undefined') {
          anime({ targets: leftWipe, left: '-10%', duration: 450, easing: 'easeOutExpo' });
          anime({ targets: rightWipe, right: '-10%', duration: 450, easing: 'easeOutExpo' });
          
          setTimeout(() => {
            try { if(typeof UISounds !== 'undefined') UISounds.stinger(); } catch(e){}
            anime({ targets: centerLogo, scale: [0, 1.2, 1], rotate: ['-5deg', '5deg', '0deg'], duration: 800, easing: 'easeOutElastic(1, .5)' });
            
            const modeScreen = document.getElementById('mode-selection-screen');
            if (screen) { screen.style.display = 'none'; }
            if (modeScreen) { modeScreen.classList.add('active'); }

            setTimeout(() => {
              try { if(typeof UISounds !== 'undefined') UISounds.whoosh(); } catch(e){}
              anime({ targets: leftWipe, left: '-100%', duration: 600, easing: 'easeInExpo' });
              anime({ targets: rightWipe, right: '-100%', duration: 600, easing: 'easeInExpo' });
              anime({ targets: centerLogo, scale: 0, duration: 400, easing: 'easeInExpo' });
              
              setTimeout(() => {
                wipeContainer.remove();
                if (typeof axoloSay === 'function' && typeof MODES_WELCOME_PHRASES !== 'undefined') {
                  const mwChoice = MODES_WELCOME_PHRASES[Math.floor(Math.random() * MODES_WELCOME_PHRASES.length)];
                  setTimeout(() => {
                    window.welcomePlaying = true;
                    axoloSay(mwChoice.text, mwChoice.file);
                    setTimeout(() => { window.welcomePlaying = false; }, 45000);
                  }, 800);
                }
              }, 700);
            }, 1400);
          }, 400);
        } else {
          if (screen) screen.style.display = 'none';
          const modeScreen = document.getElementById('mode-selection-screen');
          if (modeScreen) { modeScreen.classList.add('active'); }
          wipeContainer.remove();
        }
      }, 120);
    };
    
    const bootContent = document.querySelector('.boot-content');
    if (bootContent) bootContent.appendChild(startBtn);
  },
  fail(n, msg) {`;

  const head = lines.slice(0, startIdx);
  const tail = lines.slice(endIdx + 1);
  const res = head.join('\\n') + '\\n' + newCode + '\\n' + tail.join('\\n');
  fs.writeFileSync('public/tv.html', res);
  console.log('Fixed completely!');
} else {
  console.log('Could not find boundaries.');
}

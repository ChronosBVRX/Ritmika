// public/js/styles.js
// Centralized Jackbox-Karaoke Styles Configuration

(function initJackboxStyles() {
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    /* ── POP-ART STICKER BUTTONS ── */
    .jackbox-button-sticker {
      font-family: 'Paytone One', 'Fredoka One', sans-serif;
      font-weight: 900;
      color: #111827;
      background: #ffe600; /* Default Yellow */
      border: 8px solid #111827;
      box-shadow: 10px 10px 0px #111827;
      border-radius: 16px;
      padding: 12px 24px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      outline: none;
      position: relative;
      /* Remove default button styling */
      appearance: none;
      -webkit-appearance: none;
      transition: filter 0.2s;
    }

    /* Focus state for D-Pad / Keyboard navigation */
    .jackbox-button-sticker:focus-visible, .jackbox-button-sticker:focus {
      outline: 4px solid #fff;
      outline-offset: 4px;
      filter: brightness(1.2);
    }

    /* Color Variants */
    .jackbox-color-cyan { background: #00e5ff; }
    .jackbox-color-magenta { background: #f0047f; }
    .jackbox-color-yellow { background: #ffe600; }
    .jackbox-color-orange { background: #f97316; }

    /* Asymmetric Rotations */
    .jackbox-rot-left { transform: rotate(-2deg); }
    .jackbox-rot-right { transform: rotate(1.5deg); }

    /* ── ARCADE CONTROL BUTTONS ── */
    .jackbox-button-arcade {
      font-family: 'Paytone One', 'Fredoka One', sans-serif;
      font-weight: 900;
      color: #ffffff;
      background: #1e293b;
      border: 6px solid #111827;
      box-shadow: 8px 8px 0px #111827;
      border-radius: 12px;
      padding: 10px 20px;
      cursor: pointer;
      outline: none;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      transition: filter 0.2s;
    }
    
    .jackbox-button-arcade:focus-visible, .jackbox-button-arcade:focus {
      outline: 4px solid #fff;
      outline-offset: 4px;
      filter: brightness(1.2);
    }
  `;
  document.head.appendChild(styleEl);
})();

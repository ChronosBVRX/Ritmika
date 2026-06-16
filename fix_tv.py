import codecs

with codecs.open('public/tv.html', 'r', 'utf-8') as f:
    lines = f.readlines()

new_content = """    /* ══════════════════════════════════════════
       BOOTLOADER SCREEN
    ══════════════════════════════════════════ */
    #bootloader-screen {
      position:fixed; inset:0; z-index:100000;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      background:#0f172a;
      transition: opacity 0.6s ease;
      overflow: hidden;
    }
    #bootloader-screen.fade-out { opacity:0; pointer-events:none; }

    #boot-video-bg {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      object-fit: cover; z-index: 0;
    }
    #boot-overlay {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(15, 23, 42, 0.4); z-index: 1;
    }

    .boot-content {
      position: relative; z-index: 10;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      width: 100%; height: 100%;
    }

    .boot-checklist {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 140px;
      width: 100%;
    }

    .boot-check {
      position: absolute;
      opacity: 0;
      transform: scale(0.9);
      transition: all 0.5s cubic-bezier(0.34,1.56,0.64,1);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 15px;
      width: 100%;
    }
    .boot-check.active {
      opacity: 1;
      transform: scale(1);
    }
    .boot-check.done {
      opacity: 0;
      transform: scale(1.1);
      pointer-events: none;
    }
    .boot-check.error {
      opacity: 1;
      transform: scale(1);
    }
    
    .boot-check-text {
      font-family: 'Paytone One', sans-serif;
      font-size: 2.2rem;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #fff;
      text-shadow: 4px 4px 0px #111827, 0 0 20px rgba(0,0,0,0.8);
      text-align: center;
      animation: pulse-text 1.5s infinite alternate;
    }
    @keyframes pulse-text {
      0% { text-shadow: 4px 4px 0px #111827, 0 0 10px rgba(0,229,255,0.4); }
      100% { text-shadow: 4px 4px 0px #111827, 0 0 30px rgba(0,229,255,0.8); color: #cffafe; }
    }
    
    /* Cyber Progress Bar for each step */
    .cyber-loader {
      width: 250px;
      height: 6px;
      background: rgba(15, 23, 42, 0.6);
      border-radius: 10px;
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(0, 229, 255, 0.3);
      box-shadow: 0 0 10px rgba(0,0,0,0.5);
    }
    .cyber-loader::before {
      content: '';
      position: absolute;
      top: 0; left: 0; height: 100%; width: 40%;
      background: linear-gradient(90deg, transparent, #00e5ff, transparent);
      animation: scan-bar 1s ease-in-out infinite;
    }
    @keyframes scan-bar {
      0% { left: -40%; }
      100% { left: 100%; }
    }

    .boot-check-icon { display: none; }
    .boot-check-detail { display: none; }

    .boot-done-banner {
      position: absolute;
      font-family:'Paytone One',sans-serif; font-size:2.5rem;
      letter-spacing:2px; color: #22c55e;
      text-transform: uppercase;
      text-shadow: 4px 4px 0px #111827, 0 0 30px rgba(34,197,94,0.6);
      opacity:0; transform:scale(0.8);
      transition: all 0.5s cubic-bezier(0.34,1.56,0.64,1);
    }
    .boot-done-banner.show { opacity:1; transform:scale(1); }
    
    .boot-retry-btn {
      position: absolute;
      bottom: 2rem;
      padding:0.6rem 1.5rem;
      background:#ef4444; color:#111827; border:3px solid #111827; border-radius:10px;
      font-family:'Fredoka',sans-serif; font-size:1.2rem; font-weight:900;
      cursor:pointer; display:none;
      box-shadow: 4px 4px 0px #111827;
      z-index: 20;
    }
    .boot-retry-btn:hover { transform:translateY(-2px); box-shadow: 6px 6px 0px #111827; }
  </style>
</head>

<body class="scanlines party-bg">
<canvas id="particles-canvas"></canvas>
<div id="catalog-status">📀 Cargando catálogo...</div>

<!-- ══════════════════════════════════════════════════════════
     BOOTLOADER — Loads everything before game starts
══════════════════════════════════════════════════════════ -->
<div id="bootloader-screen" style="display:flex;">
  <video id="boot-video-bg" autoplay loop muted playsinline>
    <source src="/assets/loading_bg.mp4" type="video/mp4">
  </video>
  <div id="boot-overlay"></div>

  <div class="boot-content">
    <div class="boot-checklist">
      <div class="boot-check" id="boot-step-1">
        <span class="boot-check-text">Conectando al servidor</span>
        <div class="cyber-loader"></div>
        <span class="boot-check-icon" id="boot-icon-1">⏳</span>
        <span class="boot-check-detail" id="boot-detail-1"></span>
      </div>
      <div class="boot-check" id="boot-step-2">
        <span class="boot-check-text">Creando sala</span>
        <div class="cyber-loader"></div>
        <span class="boot-check-icon" id="boot-icon-2">⏳</span>
        <span class="boot-check-detail" id="boot-detail-2"></span>
      </div>
      <div class="boot-check" id="boot-step-3">
        <span class="boot-check-text">Cargando catálogo</span>
        <div class="cyber-loader"></div>
        <span class="boot-check-icon" id="boot-icon-3">⏳</span>
        <span class="boot-check-detail" id="boot-detail-3"></span>
      </div>
      <div class="boot-check" id="boot-step-4">
        <span class="boot-check-text">Verificando FFmpeg</span>
        <div class="cyber-loader"></div>
        <span class="boot-check-icon" id="boot-icon-4">⏳</span>
        <span class="boot-check-detail" id="boot-detail-4"></span>
      </div>
    </div>
    
    <div class="boot-done-banner" id="boot-done">¡TODO LISTO!</div>
    <button class="boot-retry-btn" id="boot-retry" onclick="location.reload()">🔄 Reintentar</button>
  </div>
</div>
"""

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if "/* ══════════════════════════════════════════" in line and "BOOTLOADER SCREEN" in lines[i+1]:
        start_idx = i
        break

if start_idx != -1:
    for i in range(start_idx, len(lines)):
        if "<!-- ══════════════════════════════════════════════════════════" in lines[i] and "SCREEN A — LOBBY" in lines[i+1]:
            end_idx = i
            break

if start_idx != -1 and end_idx != -1:
    lines = lines[:start_idx] + [new_content] + lines[end_idx:]
    with codecs.open('public/tv.html', 'w', 'utf-8') as f:
        f.writelines(lines)
    print(f"Fixed lines {start_idx} to {end_idx}")
else:
    print(f"Could not find boundaries. Start: {start_idx}, End: {end_idx}")

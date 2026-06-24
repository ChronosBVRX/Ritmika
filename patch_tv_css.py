import sys
import re

file_path = "public/tv.html"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# The previously injected CSS looks like this:
#     /* ════════════════════════════════════════════
#         EMO MODE OVERRIDES
#     ════════════════════════════════════════════ */
# ... down to }

# We will remove any block starting from the comment up to the next </style>
pattern = re.compile(r'\s*/\*\s*════════════════════════════════════════════\s*EMO MODE OVERRIDES\s*════════════════════════════════════════════\s*\*/.*?(?=\s*</style>)', re.DOTALL)
content = pattern.sub('', content)

# Now, we will insert a clean Emo CSS block right before </head>
emo_css = """
  <style id="emo-theme">
    /* ════════════════════════════════════════════
        EMO MODE OVERRIDES
    ════════════════════════════════════════════ */
    /* Background overrides */
    body[data-mode="emo"].party-bg {
      background: radial-gradient(circle at center, #1e1b4b 0%, #000000 100%) !important;
    }
    body[data-mode="emo"].party-bg::before {
      filter: grayscale(80%) sepia(20%) hue-rotate(280deg) brightness(0.6) contrast(1.2) !important;
      opacity: 0.3 !important;
    }
    
    /* Lobby Screen Overlay */
    body[data-mode="emo"] #lobby-screen::before {
      background: radial-gradient(ellipse at center, transparent 20%, rgba(15, 23, 42, 0.98) 100%) !important;
    }
    body[data-mode="emo"] #lobby-screen .lobby-glow-overlay {
      filter: hue-rotate(280deg) saturate(2) opacity(0.5) !important;
    }

    /* Panels & UI */
    body[data-mode="emo"] .jackbox-panel {
      border-color: #000 !important;
      box-shadow: 8px 8px 0px #db2777 !important; /* Magenta shadow */
    }
    body[data-mode="emo"] .text-yellow-400 {
      color: #fbcfe8 !important; /* Pink-100 instead of yellow */
    }
    body[data-mode="emo"] .text-cyan-400 {
      color: #c084fc !important; /* Purple-400 instead of cyan */
    }
    body[data-mode="emo"] .bg-pink-600 {
      background-color: #000 !important;
      border: 2px solid #db2777 !important;
    }

    /* Floating Orbs */
    body[data-mode="emo"] #orb-cyan { background:rgba(219,39,119,0.15) !important; }
    body[data-mode="emo"] #orb-pink { background:rgba(155,0,255,0.15) !important; }
    body[data-mode="emo"] #orb-purple { background:rgba(30,41,59,0.4) !important; }
    body[data-mode="emo"] #orb-magenta { background:rgba(220,38,38,0.15) !important; }
    
    /* Corners */
    body[data-mode="emo"] .lobby-corner-tl, body[data-mode="emo"] .lobby-corner-tr,
    body[data-mode="emo"] .lobby-corner-bl, body[data-mode="emo"] .lobby-corner-br {
      border-color: #db2777 !important;
    }
    
    /* Cut-in Text */
    body[data-mode="emo"] #axolo-cutin-text {
      font-family: 'Times New Roman', serif, 'Fredoka' !important;
      color: #ffffff !important;
      text-shadow: 2px 2px 0px rgba(0,0,0,0.9), -1px -1px 0px #db2777 !important;
      letter-spacing: 1px !important;
    }
  </style>
"""

content = content.replace("</head>", emo_css + "</head>")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("tv.html CSS cleaned and re-injected with stronger rules.")

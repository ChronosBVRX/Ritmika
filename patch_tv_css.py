import sys

file_path = "public/tv.html"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

emo_css = """
    /* ════════════════════════════════════════════
        EMO MODE OVERRIDES
    ════════════════════════════════════════════ */
    body[data-mode="emo"] #lobby-screen::before {
      background: radial-gradient(ellipse at center, transparent 30%, rgba(15, 23, 42, 0.95) 100%);
    }
    body[data-mode="emo"] #lobby-screen .lobby-glow-overlay {
      filter: hue-rotate(280deg) saturate(1.5) opacity(0.4);
    }
    body[data-mode="emo"] #orb-cyan { background:rgba(219,39,119,0.1); } /* Pink */
    body[data-mode="emo"] #orb-pink { background:rgba(155,0,255,0.08); } /* Purple */
    body[data-mode="emo"] #orb-purple { background:rgba(30,41,59,0.2); } /* Slate */
    body[data-mode="emo"] #orb-magenta { background:rgba(220,38,38,0.08); } /* Red */
    
    body[data-mode="emo"] .lobby-corner-tl, body[data-mode="emo"] .lobby-corner-tr,
    body[data-mode="emo"] .lobby-corner-bl, body[data-mode="emo"] .lobby-corner-br {
      border-color: #db2777;
    }
    
    body[data-mode="emo"] #axolo-cutin-text {
      font-family: 'Times New Roman', serif, 'Fredoka';
      color: #ffffff !important;
      text-shadow: 2px 2px 0px rgba(0,0,0,0.8) !important;
      letter-spacing: 1px;
    }
"""

if "EMO MODE OVERRIDES" not in content:
    content = content.replace("</style>", emo_css + "\n  </style>")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("tv.html patched with Emo CSS")

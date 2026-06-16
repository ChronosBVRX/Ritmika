import codecs
import re

with codecs.open('public/tv.html', 'r', 'utf-8') as f:
    content = f.read()

# Make a backup just in case
with codecs.open('public/tv.html.bak', 'w', 'utf-8') as f:
    f.write(content)

# We will replace all the old CSS strings with new Neo-Brutalist CSS strings.

replacements = [
    (
        "pedColor:'linear-gradient(to top,#0f172a,#22d3ee)'",
        "pedColor:'#22d3ee'"
    ),
    (
        "pedColor:'linear-gradient(to top,#064e3b,#10b981)'",
        "pedColor:'#ec4899'"
    ),
    (
        "pedColor:'linear-gradient(to top,#78350f,#eab308)'",
        "pedColor:'#facc15'"
    ),
    # Phase 1: Title block
    (
        "titleBlock.style.cssText='display:inline-block;background:#ffe600;border:6px solid #111827;box-shadow:14px 14px 0 #111827;padding:28px 64px;border-radius:24px;text-align:center;opacity:0;transform:scale(0.5) rotate(-3deg);margin-top:18px;';",
        "titleBlock.style.cssText='display:inline-block;background:#ffe600;border:6px solid #111827;box-shadow:16px 16px 0 #111827;padding:28px 64px;border-radius:0;text-align:center;opacity:0;transform:scale(0.5) rotate(-3deg);margin-top:18px;';"
    ),
    # Phase 2: Special awards
    (
        "aLabel.style.textShadow='0 0 30px '+award.color+'88';",
        "aLabel.style.textShadow='6px 6px 0 #111827, 0 0 30px '+award.color+'88';"
    ),
    (
        "aCard.style.cssText='border-radius:28px;padding:32px 52px;text-align:center;max-width:520px;width:90%;opacity:0;';",
        "aCard.style.cssText='border-radius:0;padding:32px 52px;text-align:center;max-width:520px;width:90%;opacity:0;';"
    ),
    (
        "aCard.style.background='linear-gradient(135deg,rgba(15,23,42,0.95),rgba(30,27,75,0.9))';",
        "aCard.style.background='#0f172a';"
    ),
    (
        "aCard.style.border='5px solid '+award.color;",
        "aCard.style.border='6px solid '+award.color;"
    ),
    (
        "aCard.style.boxShadow='0 0 80px '+award.color+'44,10px 10px 0 #111827';",
        "aCard.style.boxShadow='16px 16px 0 #111827, 0 0 40px '+award.color+'88';"
    ),
    (
        "border-radius:50%;overflow:hidden;background:'+av.color+'33;border:4px solid '+av.border+';display:flex;align-items:center;justify-content:center;box-shadow:0 0 14px '+av.border+'66;",
        "border-radius:50%;overflow:hidden;background:'+av.color+';border:6px solid #111827;display:flex;align-items:center;justify-content:center;box-shadow:6px 6px 0 #111827, 0 0 20px '+av.border+'66;"
    ),
    (
        "<div style=\"display:flex;align-items:center;justify-content:center;gap:14px;margin:14px 0;padding:12px 20px;border-radius:16px;background:'+award.color+'11;border:2px solid '+award.color+'33;\">",
        "<div style=\"display:flex;align-items:center;justify-content:center;gap:14px;margin:14px 0;padding:12px 20px;border-radius:0;background:'+award.color+';border:6px solid #111827;box-shadow:8px 8px 0 #111827;\">"
    ),
    (
        "<span style=\"font-family:\\'Paytone One\\',sans-serif;font-size:28px;color:#f1f5f9;\">'+escapeHtml(award.player.name)+'</span></div>",
        "<span style=\"font-family:\\'Paytone One\\',sans-serif;font-size:28px;color:#111827;\">'+escapeHtml(award.player.name)+'</span></div>"
    ),
    (
        "<div style=\"background:#0a0a1a;border:2px solid '+award.color+'33;border-radius:14px;padding:14px 20px;margin-top:10px;\">",
        "<div style=\"background:#1e293b;border:6px solid #111827;border-radius:0;padding:14px 20px;margin-top:10px;box-shadow:8px 8px 0 #111827;\">"
    ),
    (
        "<p style=\"font-family:Fredoka,sans-serif;font-size:16px;color:#cbd5e1;font-style:italic;margin:0;line-height:1.5;\">&ldquo;'+award.carrilla+'&rdquo;</p></div>",
        "<p style=\"font-family:Fredoka,sans-serif;font-size:16px;color:#f8fafc;font-weight:900;margin:0;line-height:1.5;\">&ldquo;'+award.carrilla+'&rdquo;</p></div>"
    ),
    # Phase 3: Podium pedestals
    (
        "p3title.style.cssText='font-family:\\'Paytone One\\',sans-serif;font-size:30px;color:#facc15;text-shadow:0 0 30px #facc1566;opacity:0;padding-top:28px;letter-spacing:4px;';",
        "p3title.style.cssText='font-family:\\'Paytone One\\',sans-serif;font-size:36px;color:#facc15;text-shadow:6px 6px 0 #111827, 0 0 30px #facc1566;opacity:0;padding-top:28px;letter-spacing:4px;border:6px solid #111827;background:#0f172a;padding:10px 30px;box-shadow:10px 10px 0 #111827;';"
    ),
    (
        "centerHolder.style.cssText='width:100%;border-radius:1.5rem 1.5rem 0 0;height:160px;background:rgba(250,204,21,0.05);border:3px dashed rgba(250,204,21,0.2);border-bottom:none;display:flex;align-items:center;justify-content:center;';",
        "centerHolder.style.cssText='width:100%;border-radius:0;height:160px;background:#0f172a;border:6px dashed #111827;border-bottom:none;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 20px rgba(0,0,0,0.5);margin-bottom:-6px;';"
    ),
    (
        "border-radius:50%;overflow:hidden;background:'+av.color+'22;border:5px solid '+av.border+';display:flex;align-items:center;justify-content:center;width:'+sd.size+';height:'+sd.size+';box-shadow:0 0 22px '+av.border+'66;",
        "border-radius:50%;overflow:hidden;background:'+av.color+';border:6px solid #111827;display:flex;align-items:center;justify-content:center;width:'+sd.size+';height:'+sd.size+';box-shadow:8px 8px 0 #111827;"
    ),
    (
        "<p class=\"step-score-'+sd.place+'\" style=\"font-family:\\'Paytone One\\',sans-serif;font-size:21px;color:'+sd.color+';margin:0;\">0 pts</p></div>",
        "<p class=\"step-score-'+sd.place+'\" style=\"font-family:\\'Paytone One\\',sans-serif;font-size:24px;color:'+sd.color+';margin:0;text-shadow:4px 4px 0 #111827;\">0 pts</p></div>"
    ),
    (
        "<div style=\"width:100%;border-radius:1.5rem 1.5rem 0 0;height:'+pedH+';background:'+sd.pedColor+';border:4px solid '+sd.color+';border-bottom:none;box-shadow:0 0 28px '+sd.glow+',0 -4px 16px '+sd.glow+';position:relative;overflow:hidden;\">",
        "<div style=\"width:100%;border-radius:0;height:'+pedH+';background:'+sd.color+';border:6px solid #111827;border-bottom:none;box-shadow:8px 8px 0 #111827, inset 0 0 20px '+sd.glow+';position:relative;overflow:hidden;margin-bottom:-6px;\">"
    ),
    # Phase 4: Winner Reveal
    (
        "<div style=\"margin-top:24px;background:#ffe600;border:6px solid #111827;box-shadow:10px 10px 0 #111827;padding:18px 50px;border-radius:20px;text-align:center;\">",
        "<div style=\"margin-top:24px;background:#ffe600;border:6px solid #111827;box-shadow:16px 16px 0 #111827;padding:18px 50px;border-radius:0;text-align:center;\">"
    ),
    (
        "border-radius:50%;overflow:hidden;background:'+winnerAv.color+'33;border:8px solid '+winnerAv.border+';display:flex;align-items:center;justify-content:center;box-shadow:0 0 60px '+winnerAv.border+',0 0 120px '+winnerAv.border+'88;",
        "border-radius:50%;overflow:hidden;background:'+winnerAv.color+';border:8px solid #111827;display:flex;align-items:center;justify-content:center;box-shadow:14px 14px 0 #111827;"
    ),
    (
        "<div id=\"winner-score-display\" style=\"font-family:\\'Paytone One\\',sans-serif;font-size:34px;color:#facc15;margin-top:18px;text-shadow:0 0 20px #facc15;opacity:0;\">0 pts</div>",
        "<div id=\"winner-score-display\" style=\"font-family:\\'Paytone One\\',sans-serif;font-size:42px;color:#facc15;margin-top:18px;text-shadow:6px 6px 0 #111827, 0 0 20px #facc15;opacity:0;background:#0f172a;border:6px solid #111827;padding:4px 30px;box-shadow:10px 10px 0 #111827;\">0 pts</div>"
    ),
    # Phase 5: Final Podium
    (
        "fTitle.innerHTML='<h2 style=\"font-family:\\'Paytone One\\',sans-serif;font-size:34px;color:#facc15;margin:0;text-shadow:0 0 20px #facc15,0 0 60px #facc1566;letter-spacing:3px;\">&#127942; PODIO DE GANADORES &#127942;</h2><p style=\"font-family:Fredoka,sans-serif;font-size:13px;color:#475569;margin:4px 0 0;letter-spacing:2px;text-transform:uppercase;\">&#161;El T&#237;o Axolo presenta el podio final de la noche!</p>';",
        "fTitle.innerHTML='<div style=\"background:#0f172a;border:6px solid #111827;padding:10px 40px;box-shadow:10px 10px 0 #111827;display:inline-block;\"><h2 style=\"font-family:\\'Paytone One\\',sans-serif;font-size:34px;color:#facc15;margin:0;text-shadow:6px 6px 0 #111827,0 0 20px #facc1566;letter-spacing:3px;\">&#127942; PODIO DE GANADORES &#127942;</h2><p style=\"font-family:Fredoka,sans-serif;font-size:16px;font-weight:900;color:#f8fafc;margin:4px 0 0;letter-spacing:2px;text-transform:uppercase;text-shadow:4px 4px 0 #111827;\">&#161;El T&#237;o Axolo presenta el podio final de la noche!</p></div>';"
    ),
    (
        "border-radius:50%;overflow:hidden;background:'+av.color+'22;border:'+(isWinner?'6px':'4px')+' solid '+av.border+';display:flex;align-items:center;justify-content:center;width:'+(avSizes[sd.place]||'5.5rem')+';height:'+(avSizes[sd.place]||'5.5rem')+';box-shadow:0 0 '+(isWinner?'40px':'20px')+' '+av.border+'66;",
        "border-radius:50%;overflow:hidden;background:'+av.color+';border:6px solid #111827;display:flex;align-items:center;justify-content:center;width:'+(avSizes[sd.place]||'5.5rem')+';height:'+(avSizes[sd.place]||'5.5rem')+';box-shadow:8px 8px 0 #111827;"
    ),
    (
        "<p class=\"final-score-'+sd.place+'\" style=\"font-family:\\'Paytone One\\',sans-serif;font-size:'+(isWinner?'24px':'20px')+';color:'+sd.color+';margin:0;text-shadow:0 0 12px '+sd.color+'66;\">0 pts</p></div>'",
        "<p class=\"final-score-'+sd.place+'\" style=\"font-family:\\'Paytone One\\',sans-serif;font-size:'+(isWinner?'28px':'22px')+';color:'+sd.color+';margin:0;text-shadow:4px 4px 0 #111827,0 0 12px '+sd.color+'66;\">0 pts</p></div>'"
    ),
    (
        "<div style=\"width:100%;border-radius:1.5rem 1.5rem 0 0;height:'+(pedHeights[sd.place]||'80px')+';background:'+sd.pedColor+';border:4px solid '+sd.color+';border-bottom:none;box-shadow:0 0 40px '+sd.glow+',inset 0 1px 0 rgba(255,255,255,0.2);position:relative;overflow:hidden;\">",
        "<div style=\"width:100%;border-radius:0;height:'+(pedHeights[sd.place]||'80px')+';background:'+sd.color+';border:6px solid #111827;border-bottom:none;box-shadow:12px 12px 0 #111827,inset 0 0 20px rgba(255,255,255,0.3);position:relative;overflow:hidden;margin-bottom:-6px;\">"
    ),
    # Bottom panels
    (
        "awardsPanel.style.cssText='flex:1;background:rgba(15,23,42,0.6);backdrop-filter:blur(12px);border:2px solid rgba(51,65,85,0.6);border-radius:16px;padding:10px 14px;display:flex;flex-direction:column;';",
        "awardsPanel.style.cssText='flex:1;background:#1e293b;border:6px solid #111827;border-radius:0;padding:10px 14px;display:flex;flex-direction:column;box-shadow:10px 10px 0 #111827;';"
    ),
    (
        "<div style=\"width:28px;height:28px;border-radius:50%;overflow:hidden;background:#0f172a;border:2px solid '+av.border+';display:flex;align-items:center;justify-content:center;margin:2px 0;\">",
        "<div style=\"width:32px;height:32px;border-radius:50%;overflow:hidden;background:'+av.color+';border:4px solid #111827;display:flex;align-items:center;justify-content:center;margin:2px 0;box-shadow:4px 4px 0 #111827;\">"
    ),
    (
        "sbPanel.style.cssText='width:290px;background:rgba(15,23,42,0.6);backdrop-filter:blur(12px);border:2px solid rgba(51,65,85,0.6);border-radius:16px;padding:10px 14px;display:flex;flex-direction:column;flex-shrink:0;';",
        "sbPanel.style.cssText='width:290px;background:#1e293b;border:6px solid #111827;border-radius:0;padding:10px 14px;display:flex;flex-direction:column;flex-shrink:0;box-shadow:10px 10px 0 #111827;';"
    ),
    (
        "<div style=\"display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:10px;background:'+(isTop?'rgba(250,204,21,0.1)':'rgba(30,41,59,0.4)')+';border:1px solid '+(isTop?'rgba(250,204,21,0.3)':'rgba(51,65,85,0.4)')+';\">",
        "<div style=\"display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:0;background:'+(isTop?'#facc15':'#334155')+';border:4px solid #111827;box-shadow:4px 4px 0 #111827;\">"
    ),
    (
        "<span style=\"font-size:12px;width:18px;text-align:center;\">'+(medals[i]||'#'+(i+1))+'</span>'",
        "<span style=\"font-size:12px;width:18px;text-align:center;font-weight:900;color:'+(isTop?'#111827':'#f1f5f9')+';\">'+(medals[i]||'#'+(i+1))+'</span>'"
    ),
    (
        "<div style=\"width:22px;height:22px;border-radius:5px;overflow:hidden;background:#0f172a;border:1px solid '+av.border+';display:flex;align-items:center;justify-content:center;flex-shrink:0;\">",
        "<div style=\"width:24px;height:24px;border-radius:50%;overflow:hidden;background:'+av.color+';border:2px solid #111827;display:flex;align-items:center;justify-content:center;flex-shrink:0;\">"
    ),
    (
        "<span style=\"font-weight:700;flex:1;color:#e2e8f0;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\">'+escapeHtml(p.name)+'</span>'",
        "<span style=\"font-weight:900;flex:1;color:'+(isTop?'#111827':'#e2e8f0')+';font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\">'+escapeHtml(p.name)+'</span>'"
    ),
    (
        "<span style=\"font-weight:900;font-size:12px;color:'+scoreColor+';\">'+(p.score||0)+'</span>'",
        "<span style=\"font-weight:900;font-size:12px;color:'+(isTop?'#111827':scoreColor)+';\">'+(p.score||0)+'</span>'"
    ),
    (
        "<span style=\"font-size:9px;color:#64748b;\">pts</span>'",
        "<span style=\"font-size:9px;color:'+(isTop?'#111827':'#64748b')+';font-weight:900;\">pts</span>'"
    ),
    # Restart Button
    (
        "restartBtn.style.cssText='background:linear-gradient(135deg,#ec4899,#a855f7);color:white;border:4px solid #111827;cursor:pointer;box-shadow:6px 6px 0 #111827;padding:13px 42px;border-radius:16px;font-family:\\'Paytone One\\',sans-serif;font-size:18px;letter-spacing:1px;margin-top:4px;flex-shrink:0;transition:transform 0.15s,box-shadow 0.15s;';",
        "restartBtn.style.cssText='background:#ffe600;color:#111827;border:6px solid #111827;cursor:pointer;box-shadow:10px 10px 0 #111827;padding:13px 42px;border-radius:0;font-family:\\'Paytone One\\',sans-serif;font-size:22px;letter-spacing:1px;margin-top:4px;flex-shrink:0;transition:transform 0.15s,box-shadow 0.15s;text-transform:uppercase;';"
    ),
    (
        "restartBtn.onmouseover=()=>{restartBtn.style.transform='translateY(-3px)';restartBtn.style.boxShadow='6px 9px 0 #111827';};",
        "restartBtn.onmouseover=()=>{restartBtn.style.transform='translateY(4px) translateX(4px)';restartBtn.style.boxShadow='6px 6px 0 #111827';};"
    ),
    (
        "restartBtn.onmouseout=()=>{restartBtn.style.transform='';restartBtn.style.boxShadow='6px 6px 0 #111827';};",
        "restartBtn.onmouseout=()=>{restartBtn.style.transform='';restartBtn.style.boxShadow='10px 10px 0 #111827';};"
    ),
]

new_content = content
for old, new in replacements:
    if old not in new_content:
        print(f"WARNING: Could not find: {old[:50]}...")
    new_content = new_content.replace(old, new)

with codecs.open('public/tv.html', 'w', 'utf-8') as f:
    f.write(new_content)

print("Applied neo-brutalist styling successfully.")

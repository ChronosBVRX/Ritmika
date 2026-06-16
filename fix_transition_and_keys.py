import codecs
import re

with codecs.open('public/tv.html', 'r', 'utf-8') as f:
    content = f.read()

# 1. Add fade-in animation
old_css = """    #bootloader-screen {
      position:fixed; inset:0; z-index:100000;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      background:#0f172a;
      transition: opacity 0.6s ease;
      overflow: hidden;
    }"""
new_css = """    #bootloader-screen {
      position:fixed; inset:0; z-index:100000;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      background:#0f172a;
      transition: opacity 0.6s ease;
      overflow: hidden;
      animation: fade-in-boot 0.8s ease-out;
    }
    @keyframes fade-in-boot {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }"""
if old_css in content:
    content = content.replace(old_css, new_css)
    print("Added fade-in-boot animation.")
else:
    print("Could not find bootloader-screen CSS.")


# 2. Wrap debug buttons
old_html = """      <!-- Panel de Debug -->
      <div class="flex flex-col gap-2 p-3 rounded-xl mt-2" style="background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.2);">
        <span class="text-[10px] font-black uppercase tracking-widest" style="color:#ef4444;">⚙️ Debug</span>
        <div class="flex gap-2">
          <button id="btn-debug-add-bot" class="jackbox-button-arcade flex-1" tabindex="0" style="background:#e11d48; font-size:12px; padding:6px;">🤖 +Bot</button>
          <button id="btn-debug-start-game" class="jackbox-button-arcade flex-1" tabindex="0" style="background:#059669; font-size:12px; padding:6px;">⚡ Forzar</button>
        </div>
      </div>"""
new_html = """      <!-- Panel de Debug Oculto (F9) -->
      <div id="secret-debug-panel" style="display:none; margin-top:8px;">
        <div class="flex flex-col gap-2 p-3 rounded-xl mt-2" style="background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.2);">
          <span class="text-[10px] font-black uppercase tracking-widest" style="color:#ef4444;">⚙️ Debug</span>
          <div class="flex gap-2">
            <button id="btn-debug-add-bot" class="jackbox-button-arcade flex-1" tabindex="0" style="background:#e11d48; font-size:12px; padding:6px;">🤖 +Bot</button>
            <button id="btn-debug-start-game" class="jackbox-button-arcade flex-1" tabindex="0" style="background:#059669; font-size:12px; padding:6px;">⚡ Forzar</button>
          </div>
        </div>
      </div>"""
if old_html in content:
    content = content.replace(old_html, new_html)
    print("Wrapped debug panel.")
else:
    print("Could not find debug HTML.")

# 3. Modify keydown event for F9
old_js = """document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'b') {
    e.preventDefault();
    const debugPanel = document.getElementById('debug-panel-container');
    if (debugPanel) debugPanel.style.display = debugPanel.style.display === 'none' ? 'flex' : 'none';
  }
});"""
new_js = """document.addEventListener('keydown', (e) => {
  if (e.key === 'F9') {
    e.preventDefault();
    const debugPanel = document.getElementById('secret-debug-panel');
    if (debugPanel) debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
  }
});"""
if old_js in content:
    content = content.replace(old_js, new_js)
    print("Modified hotkey to F9.")
else:
    print("Could not find keydown listener JS.")

with codecs.open('public/tv.html', 'w', 'utf-8') as f:
    f.write(content)

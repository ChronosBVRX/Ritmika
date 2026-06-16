import codecs

with codecs.open('public/tv.html', 'r', 'utf-8') as f:
    content = f.read()

# 1. Update Avatars
content = content.replace(
    'class="avatar-bubble text-5xl mb-2 flex items-center justify-center border-4" id="podium-avatar-2" style="width:5rem; height:5rem; border-radius:50%;"',
    'class="avatar-bubble text-5xl mb-2 flex items-center justify-center" id="podium-avatar-2" style="width:5rem; height:5rem; border-radius:50%; border:4px solid #111827; box-shadow:6px 6px 0px #111827;"'
)
content = content.replace(
    'class="avatar-bubble text-6xl flex items-center justify-center border-4 relative z-10" id="podium-avatar-1" style="width:6rem; height:6rem; border-radius:50%;"',
    'class="avatar-bubble text-6xl flex items-center justify-center relative z-10" id="podium-avatar-1" style="width:6rem; height:6rem; border-radius:50%; border:4px solid #111827; box-shadow:6px 6px 0px #111827;"'
)
content = content.replace(
    'class="avatar-bubble text-5xl mb-2 flex items-center justify-center border-4" id="podium-avatar-3" style="width:5rem; height:5rem; border-radius:50%;"',
    'class="avatar-bubble text-5xl mb-2 flex items-center justify-center" id="podium-avatar-3" style="width:5rem; height:5rem; border-radius:50%; border:4px solid #111827; box-shadow:6px 6px 0px #111827;"'
)

# 2. Update Panels (Special Awards & Final Scoreboard)
# original: class="flex-1 bg-slate-900/40 backdrop-blur border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between"
content = content.replace(
    'class="flex-1 bg-slate-900/40 backdrop-blur border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between"',
    'class="flex-1 rounded-2xl p-4 flex flex-col justify-between" style="background:#1e293b; border:4px solid #111827; box-shadow:8px 8px 0px #111827;"'
)
# original: class="w-[360px] bg-slate-900/40 backdrop-blur border border-slate-800/80 rounded-2xl p-4 flex flex-col"
content = content.replace(
    'class="w-[360px] bg-slate-900/40 backdrop-blur border border-slate-800/80 rounded-2xl p-4 flex flex-col"',
    'class="w-[360px] rounded-2xl p-4 flex flex-col" style="background:#1e293b; border:4px solid #111827; box-shadow:8px 8px 0px #111827;"'
)

# 3. Update Restart Button
content = content.replace(
    'class="px-10 py-3 rounded-xl font-black text-lg mt-2"\n      style="background:linear-gradient(135deg,#ec4899,#a855f7); color:white; border:none; cursor:pointer; box-shadow:0 0 30px #ec489966; z-index:20;"',
    'class="px-10 py-3 rounded-xl font-black text-lg mt-2"\n      style="background:#f0047f; color:white; border:4px solid #111827; cursor:pointer; box-shadow:6px 6px 0px #111827; z-index:20; transition: transform 0.1s; active:transform:translate(4px,4px);"'
)
content = content.replace(
    'class="px-10 py-3 rounded-xl font-black text-lg mt-2"\\n      style="background:linear-gradient(135deg,#ec4899,#a855f7); color:white; border:none; cursor:pointer; box-shadow:0 0 30px #ec489966; z-index:20;"',
    'class="px-10 py-3 rounded-xl font-black text-lg mt-2"\\n      style="background:#f0047f; color:white; border:4px solid #111827; cursor:pointer; box-shadow:6px 6px 0px #111827; z-index:20;"'
)
# Wait, let me just match the exact substring for the restart button:
restart_btn_old = """    <button id="restart-btn" class="px-10 py-3 rounded-xl font-black text-lg mt-2"
      style="background:linear-gradient(135deg,#ec4899,#a855f7); color:white; border:none; cursor:pointer; box-shadow:0 0 30px #ec489966; z-index:20;">"""
restart_btn_new = """    <button id="restart-btn" class="px-10 py-3 rounded-xl font-black text-lg mt-2 transition-transform active:translate-x-1 active:translate-y-1"
      style="background:#f0047f; color:white; border:4px solid #111827; cursor:pointer; box-shadow:6px 6px 0px #111827; z-index:20;">"""
if restart_btn_old in content:
    content = content.replace(restart_btn_old, restart_btn_new)


# 4. Update Continue Button in Scoreboard overlay
continue_btn_old = """        <button id="continue-btn" class="mt-6 w-full py-3 rounded-xl font-black text-lg"
          style="background:linear-gradient(135deg,#ec4899,#a855f7); color:white; border:none; cursor:pointer;">"""
continue_btn_new = """        <button id="continue-btn" class="mt-6 w-full py-3 rounded-xl font-black text-lg transition-transform active:translate-x-1 active:translate-y-1"
          style="background:#00e5ff; color:#111827; border:4px solid #111827; cursor:pointer; box-shadow:6px 6px 0px #111827;">"""
if continue_btn_old in content:
    content = content.replace(continue_btn_old, continue_btn_new)

with codecs.open('public/tv.html', 'w', 'utf-8') as f:
    f.write(content)

print("HTML elements updated.")

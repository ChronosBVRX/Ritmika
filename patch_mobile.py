import sys

file_path = "public/mobile.html"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update me object
content = content.replace(
    """const me = {
  socketId: null,
  name: '',
  avatarId: 0,
  score: 0,
  tomatazos: 0
};""",
    """const me = {
  socketId: null,
  name: '',
  avatarId: 0,
  score: 0,
  tomatazos: 0,
  gameMode: 'clasico'
};"""
)

# 2. Update player:join_ack
content = content.replace(
    "socket.on('player:join_ack', ({ success, error, roomCode, players }) => {",
    "socket.on('player:join_ack', ({ success, error, roomCode, mode, players }) => {"
)
content = content.replace(
    "    document.getElementById('display-room-code').textContent = state.roomCode;",
    "    document.getElementById('display-room-code').textContent = state.roomCode;\n    me.gameMode = mode || 'clasico';\n    if (typeof applyMobileModeTheme === 'function') applyMobileModeTheme();"
)

# 3. Add applyMobileModeTheme definition at the end of scripts
script_addition = """
function applyMobileModeTheme() {
  document.body.dataset.mode = me.gameMode || 'clasico';

  if (me.gameMode === 'emo') {
    // Votación
    const voteLabels = document.querySelectorAll('#screen-vote .opacity-70');
    if (voteLabels.length >= 4) {
      voteLabels[0].textContent = 'Me rompió el corazón · 100 pts';
      voteLabels[1].textContent = 'Dolió bonito · 60 pts';
      voteLabels[2].textContent = 'Fue dramático · 30 pts';
      voteLabels[3].textContent = 'Ni mi ex me lastimó tanto · 10 pts';
    }
    // Asignación (Ronda 2)
    const assignTitle = document.querySelector('#screen-assign h2');
    if (assignTitle) assignTitle.textContent = 'Dedicada al Ex';
    const assignDesc = document.querySelector('#screen-assign p.text-sm');
    if (assignDesc) assignDesc.textContent = 'Elige a quién se la dedicas y con qué indirecta';
    
    const victimLabel = document.querySelector('#screen-assign .mb-4:nth-of-type(1) p');
    if (victimLabel) victimLabel.textContent = '¿A QUIÉN SE LA DEDICAS?';
    const songLabel = document.querySelector('#screen-assign .mb-4:nth-of-type(2) p');
    if (songLabel) songLabel.textContent = 'INDIRECTA MUSICAL';
    const sendBtn = document.getElementById('btn-send-assignment');
    if (sendBtn) sendBtn.innerHTML = '💔 Dedicar con dolor';
  } else {
    // Restaurar a Clásico
    const voteLabels = document.querySelectorAll('#screen-vote .opacity-70');
    if (voteLabels.length >= 4) {
      voteLabels[0].textContent = 'Dale un Grammy · 100 pts';
      voteLabels[1].textContent = 'Ni fu ni fa · 60 pts';
      voteLabels[2].textContent = 'Casi, casi · 30 pts';
      voteLabels[3].textContent = 'Desafinado total · 10 pts';
    }
    const assignTitle = document.querySelector('#screen-assign h2');
    if (assignTitle) assignTitle.textContent = 'Fuego Cruzado';
    const assignDesc = document.querySelector('#screen-assign p.text-sm');
    if (assignDesc) assignDesc.textContent = 'Elige a quién atacar y con qué canción';
    
    const victimLabel = document.querySelector('#screen-assign .mb-4:nth-of-type(1) p');
    if (victimLabel) victimLabel.textContent = 'VÍCTIMA';
    const songLabel = document.querySelector('#screen-assign .mb-4:nth-of-type(2) p');
    if (songLabel) songLabel.textContent = 'CANCIÓN ASESINA';
    const sendBtn = document.getElementById('btn-send-assignment');
    if (sendBtn) sendBtn.innerHTML = '🎯 ¡Lanzar el ataque!';
  }
}
"""
if "applyMobileModeTheme" not in content:
    content = content.replace("</script>", script_addition + "\n</script>")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("mobile.html updated!")

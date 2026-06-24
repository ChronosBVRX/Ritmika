import sys

file_path = "public/js/tv/game.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

orig_start_text = """    let rStartText = '';
    let barkFile = `round_${state.round}_start_${rStartIdx}.mp3`;
    if (state.gameMode === 'emo') {
      if (state.round === 1) {
        rStartText = "¡Bienvenidos a Fiesta Emo! Hoy no se canta, se sangra emocionalmente. 🖤";
        barkFile = 'emo_intro_0.mp3';
      } else if (state.round === 2) {
        rStartText = "Elige a quién vas a destruir emocionalmente. 💔";
        barkFile = 'emo_intro_1.mp3';
      } else {
        rStartText = "Cuando la pantalla se apague, canta como si todavía doliera. 🌑";
        barkFile = 'emo_blackout_0.mp3';
      }
    } else {"""

new_start_text = """    let rStartText = '';
    let barkFile = `round_${state.round}_start_${rStartIdx}.mp3`;
    if (state.gameMode === 'emo') {
      let phrases = EMO_MODE_PHRASES.intro;
      if (state.round === 2) phrases = EMO_MODE_PHRASES.intro; // You can mix if needed, or just intro
      if (state.round === 3) phrases = EMO_MODE_PHRASES.blackout;
      
      const choice = phrases[Math.floor(Math.random() * phrases.length)];
      rStartText = choice.text;
      barkFile = choice.file;
    } else {"""

orig_spin = """  const spinIdx = Math.floor(Math.random() * 2);
  const spinText = spinIdx === 0 ? "¡Girando la ruleta del destino! A ver quién sufre primero" : "¡Vamos a ver de quién es el turno! Que la suerte los acompañe.";
  const spinChoice = { text: spinText, file: `roulette_spin_${spinIdx}.mp3` };
  axoloSay(spinChoice.text, spinChoice.file);"""

new_spin = """  const spinIdx = Math.floor(Math.random() * 2);
  let spinChoice = { text: spinIdx === 0 ? "¡Girando la ruleta del destino! A ver quién sufre primero" : "¡Vamos a ver de quién es el turno! Que la suerte los acompañe.", file: `roulette_spin_${spinIdx}.mp3` };
  if (state.gameMode === 'emo' && typeof EMO_MODE_PHRASES !== 'undefined') {
    const phrases = EMO_MODE_PHRASES.roulette;
    spinChoice = phrases[Math.floor(Math.random() * phrases.length)];
  }
  axoloSay(spinChoice.text, spinChoice.file);"""

orig_vote = """  const voteText = vIdx === 0 ? "¡Hora de votar! ¿Qué les pareció la actuación?" : "¡A votar se ha dicho! Califiquen esta obra de arte... o de desastre.";
  const votePrompt = { text: voteText, file: `vote_start_${vIdx}.mp3` };
  axoloSay(votePrompt.text, votePrompt.file);"""

new_vote = """  const voteText = vIdx === 0 ? "¡Hora de votar! ¿Qué les pareció la actuación?" : "¡A votar se ha dicho! Califiquen esta obra de arte... o de desastre.";
  let votePrompt = { text: voteText, file: `vote_start_${vIdx}.mp3` };
  if (state.gameMode === 'emo' && typeof EMO_MODE_PHRASES !== 'undefined') {
    const phrases = EMO_MODE_PHRASES.vote;
    votePrompt = phrases[Math.floor(Math.random() * phrases.length)];
  }
  axoloSay(votePrompt.text, votePrompt.file);"""

orig_selected = """  const selectedIdx = Math.floor(Math.random() * 2);
  const selectedText = selectedIdx === 0 ? "¡Te tocó! Pasa al frente y prepárate para cantar." : "¡Es tu turno! Demuestra de qué estás hecho.";
  const winChoice = { text: selectedText, file: `roulette_win_${selectedIdx}.mp3` };
  let winMsgText = winChoice.text.replace('Te tocó', `¡Le tocó a ${p.name}!`).replace('Es tu turno', `¡El turno es de ${p.name}!`);
  axoloSay(winMsgText, winChoice.file);"""

new_selected = """  const selectedIdx = Math.floor(Math.random() * 2);
  let winChoice = { text: selectedIdx === 0 ? "¡Te tocó! Pasa al frente y prepárate para cantar." : "¡Es tu turno! Demuestra de qué estás hecho.", file: `roulette_win_${selectedIdx}.mp3` };
  if (state.gameMode === 'emo' && typeof EMO_MODE_PHRASES !== 'undefined') {
    const phrases = EMO_MODE_PHRASES.selected;
    winChoice = phrases[Math.floor(Math.random() * phrases.length)];
  }
  let winMsgText = winChoice.text.replace('Te tocó', `¡Le tocó a ${p.name}!`).replace('Es tu turno', `¡El turno es de ${p.name}!`);
  axoloSay(winMsgText, winChoice.file);"""

if orig_start_text in content: content = content.replace(orig_start_text, new_start_text)
if orig_spin in content: content = content.replace(orig_spin, new_spin)
if orig_vote in content: content = content.replace(orig_vote, new_vote)
if orig_selected in content: content = content.replace(orig_selected, new_selected)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("game.js random emo phrases patched")

import sys

file_path = "public/js/tv/game.js"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

awards_data_orig = """  const awardsData = [
    { icon:'&#128019;', img: './assets/award_gallo.webp', title:'Gallo Supremo',    subtitle:'Valor Desafinado', player: sorted[sorted.length-1], color:'#6b7280', border:'#4b5563', obj: rand(AWARD_CARRILLA.gallo) },
    { icon:'&#127813;', img: './assets/award_tomate.webp', title:'Salsa de Tomate',  subtitle:'El M&#225;s Atacado',   player: mostTomatoes && mostTomatoes.tomatazos > 0 ? mostTomatoes : null, color:'#ef4444', border:'#dc2626', obj: rand(AWARD_CARRILLA.tomate) },
    { icon:'&#128535;', img: './assets/award_vengador.webp', title:'Vengador An&#243;nimo', subtitle:'Fuego Cruzado',    player: vengador, color:'#a855f7', border:'#9333ea', obj: rand(AWARD_CARRILLA.vengador) },
  ].map(a => ({...a, carrilla: a.obj.text, file: a.obj.file}));"""

awards_data_replace = """  let awardsData = [];
  if (state.gameMode === 'emo') {
    awardsData = [
      { icon:'💔', img: './assets/modes/emo/award_broken_heart.webp', title:'Corazón Más Roto', subtitle:'Mayor Sufrimiento', player: sorted[sorted.length-1], color:'#6b7280', border:'#4b5563', obj: {text:'Ni tu ex te dejó tan mal como esta puntuación.', file: 'emo_award_0.mp3'} },
      { icon:'📱', img: './assets/modes/emo/award_indirecta.webp', title:'Mejor Indirecta', subtitle:'Fuego Cruzado Emo', player: vengador, color:'#a855f7', border:'#9333ea', obj: {text:'Esa indirecta dolió hasta en la otra cuadra.', file: 'emo_award_1.mp3'} },
      { icon:'🌑', img: './assets/modes/emo/award_blackout.webp', title:'Sobreviviente', subtitle:'Superó el Apagón', player: sorted[0], color:'#facc15', border:'#eab308', obj: {text:'Cantaste en la oscuridad mejor que en la luz.', file: 'emo_award_2.mp3'} },
    ];
  } else {
    awardsData = [
      { icon:'&#128019;', img: './assets/award_gallo.webp', title:'Gallo Supremo',    subtitle:'Valor Desafinado', player: sorted[sorted.length-1], color:'#6b7280', border:'#4b5563', obj: rand(AWARD_CARRILLA.gallo) },
      { icon:'&#127813;', img: './assets/award_tomate.webp', title:'Salsa de Tomate',  subtitle:'El M&#225;s Atacado',   player: mostTomatoes && mostTomatoes.tomatazos > 0 ? mostTomatoes : null, color:'#ef4444', border:'#dc2626', obj: rand(AWARD_CARRILLA.tomate) },
      { icon:'&#128535;', img: './assets/award_vengador.webp', title:'Vengador An&#243;nimo', subtitle:'Fuego Cruzado',    player: vengador, color:'#a855f7', border:'#9333ea', obj: rand(AWARD_CARRILLA.vengador) },
    ];
  }
  awardsData = awardsData.map(a => ({...a, carrilla: a.obj.text, file: a.obj.file}));"""

content = content.replace(awards_data_orig, awards_data_replace)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("game.js podium updated!")

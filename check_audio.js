const fs = require('fs');
const { execSync } = require('child_process');
const dir = './public/assets/audio';
const files = [
    'podium_intro_ceremony.mp3', 
    'podium_award_gallo.mp3', 
    'podium_award_tomate.mp3', 
    'podium_award_vengador.mp3', 
    'podium_reveal_third.mp3', 
    'podium_reveal_second.mp3', 
    'podium_winner_buildup.mp3', 
    'podium_winner_reveal.mp3'
];
files.forEach(f => {
    try {
        const cmd = `ffprobe -i "${dir}/${f}" -show_entries format=duration -v quiet -of csv="p=0"`;
        const d = execSync(cmd).toString().trim();
        console.log(`${f}: ${d} seconds`);
    } catch(e) {
        console.log(`${f}: error checking duration`);
    }
});

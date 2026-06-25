const db = require('better-sqlite3')('server/songs.db');

const modeMappings = {
  emo: [
    'Panda', 'PXNDX', 'Kudai', 'Linkin Park', 'Green Day', 'Simple Plan', 
    'Nikki Clan', 'Mago de OZ', 'Zoe', 'Fobia', 'Allison'
  ],
  ranchera: [
    // Rancheras & Dolidas specific artists not explicitly genre=ranchera
    'Paquita La Del Barrio', 'Paquita la del Barrio', "Lupita D'alessio", 
    'Rocio Durcal', 'Ana Gabriel', 'Rocio Jurado', 'Juan Gabriel', 
    'Alejandro Fernandez', 'Vicente Fernandez', 'Jenni Rivera', 
    'Christian Nodal', 'Carin Leon & Grupo Frontera', 'Espinoza Paz', 
    'El Komander', 'Chalino Sanchez', 'Los Tigres Del Norte', 'Banda MS', 
    'Intocable', 'Los Temerarios', 'Julion Alvarez', 'Banda el Recodo',
    'La Arrolladora Banda el Limon'
  ],
  nostalgia: [
    'Timbiriche', 'La Nueva Banda Timbiriche', 'OV7', 'Kabah', 'Mecano', 
    'Magneto', 'Fey', 'Sentidos Opuestos', 'Flans', 'Pandora', 'Luis Miguel', 
    'Chayanne', 'Ricky Martin', 'Thalia', 'Paulina Rubio', 'Alejandra Guzman', 
    'Gloria Trevi', 'RBD', 'Belinda', 'Menudo', 'Garibaldi', 'Jeans', 'Magneto', 'MDO', 'Menudo'
  ]
};

// Start transaction
const updateTx = db.transaction(() => {
  // 1. Clear all current modes (except null)
  db.prepare("UPDATE songs SET mode = NULL").run();

  // 2. Dolidas & Rancheras: all genre='ranchera'
  db.prepare("UPDATE songs SET mode = 'ranchera' WHERE LOWER(genre) = 'ranchera'").run();

  // 3. Update by artists (for emo, ranchera, nostalgia)
  const updateStmt = db.prepare("UPDATE songs SET mode = ? WHERE LOWER(artist) LIKE LOWER(?) OR LOWER(artist) LIKE LOWER(?)");

  for (const [mode, artists] of Object.entries(modeMappings)) {
    for (const artist of artists) {
      // Direct match or partial match for featuring
      updateStmt.run(mode, artist, `%${artist}%`);
    }
  }
});

try {
  console.log("Starting DB modes update...");
  updateTx();
  console.log("Update completed successfully!");

  // Verify
  const counts = db.prepare("SELECT mode, COUNT(*) as count FROM songs GROUP BY mode").all();
  console.log("Results:");
  console.table(counts);

} catch (err) {
  console.error("Error updating modes:", err);
}

// Compatibilidad: server/index.js delega a server/local/index.js
// Mantener este archivo para `node server/index.js` y `npm start`
require('./local/index.js');

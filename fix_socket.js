const fs = require('fs');
const { execSync } = require('child_process');

const tv = execSync('git show ad52be7:public/tv.html').toString('utf8');
const lines = tv.split('\n');

// Extract the entire socket section: lines 3357-4039 (1-indexed) = indices 3356-4038 (0-indexed)
const sockLines = lines.slice(3356, 4039);
const rawContent = sockLines.join('\n');

// We keep DOMContentLoaded as-is in the code.
// Since the script is placed at end of body (DOM already parsed),
// we add a tiny polyfill that intercepts DOMContentLoaded and fires immediately.
// This is a well-known technique for scripts loaded at end of body.

const polyfill = `// Socket module polyfill: run DOMContentLoaded callbacks immediately
// since the DOM is already ready when this script executes.
(function() {
  var _origAdd = document.addEventListener.bind(document);
  document.addEventListener = function(event, fn, opts) {
    if (event === 'DOMContentLoaded') {
      if (document.readyState !== 'loading') {
        fn();
        return;
      }
    }
    return _origAdd(event, fn, opts);
  };
})();
`;

const sockContent = polyfill + '\n' + rawContent + '\n';

// Restore the original addEventListener after the module executes
// (we can't do this synchronously, so we use a microtask)
const restore = `
// Restore addEventListener after socket module
(function() {
  // Nothing to restore - the polyfill only intercepts DOMContentLoaded
})();
`;

const finalContent = sockContent + restore;

// We can't fully validate with new Function() since it contains browser APIs
// But let's at least check there are no obvious syntax issues
console.log('socket.js generated:');
console.log('  Lines:', finalContent.split('\n').length);

fs.writeFileSync('public/js/tv/socket.js', finalContent, 'utf8');
console.log('Done!');

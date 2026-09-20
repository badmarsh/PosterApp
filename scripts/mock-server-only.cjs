
const m = require('module');
const orig = m._resolveFilename;
m._resolveFilename = function(request, parent, isMain, options) {
  if (request === 'server-only') {
    return __filename;
  }
  return orig.apply(this, arguments);
};


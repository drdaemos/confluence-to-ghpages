var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var sanitize = require("sanitize-filename");

function rmDir(dirPath, removeSelf) {
  if (removeSelf === undefined)
    removeSelf = true;
  try { var files = fs.readdirSync(dirPath); }
  catch(e) { return; }
  if (files.length > 0)
    for (var i = 0; i < files.length; i++) {
      var filePath = dirPath + '/' + files[i];
      if (fs.statSync(filePath).isFile())
        fs.unlinkSync(filePath);
      else
        rmDir(filePath);
    }
  if (removeSelf)
    fs.rmdirSync(dirPath);
};

function createDir(dirPath) {
  try {
    mkdirp.sync(dirPath);
  } catch(err) {
    if (err.code != 'EEXIST') throw err;
  }
}

function sanitizeFilename(string) {
  return string && sanitize(string) !== null
      ? sanitize(string).replace(/\s/g, '_').toLowerCase()
      : '';
}

String.prototype.contains = function(it) { return this.indexOf(it) !== -1; };

exports.rmDir = rmDir;
exports.createDir = createDir;
exports.sanitizeFilename = sanitizeFilename;
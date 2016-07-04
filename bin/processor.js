var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var find = require('find');
var readdirRec = require('recursive-readdir');
var log = require('verbalize');
var ProgressBar = require('progress');
var converter = require('./converter');
var utils = require('./utils');

function Processor(options) {
  this.input = options.input;
  this.output = options.output;
  this.movedLinks = [];
}

Processor.prototype.run = function() {
  var self = this;
  // bootstrap
  fs.readdir( this.input, function( err, files ) {
    if( err ) {
        log.error( "Could not list the input directory.", err );
        process.exit( 1 );
    }

    self.convertFiles(files);
  });
}

Processor.prototype.setupProgressBar = function (length, msg, callback) {
  this.bar = new ProgressBar(':current/:total :bar :percent | :file', {
    width: 20,
    total: length,
    callback: () => {
      log.success('  ' + msg + ' [done]');
      if (typeof(callback) !== 'undefined') callback();
    }
  });
}

Processor.prototype.convertFiles = function (files) {
  this.setupProgressBar(files.length, 'HTML to MD conversion', this.moveIndexPages.bind(this));
  var self = this;
  files.forEach( function( file, index ) {

    var filePath = path.resolve(path.join(self.input, file));
    var outputFolder = path.resolve(self.output);
    fs.stat(filePath, function(err, stat) {

      if (stat.isFile()) {

        fs.readFile(filePath, 'utf-8', (err, data) => {
          if (err) throw err;

          var converted = converter.convert(data);
          var folderPath = converter.getFilepath(data);
          var filename = converter.getFilename(data) || path.basename(file, '.html');

          // write old and new path to dictionary to fix links later
          self.movedLinks.push({
            'oldLink': file,
            'newLink': path.join(folderPath, filename + '.html'),
          });

          utils.createDir(path.join(outputFolder, folderPath));

          var outputFile = path.join(outputFolder, folderPath, filename + '.md');
          fs.writeFileSync(outputFile, converted);

          self.bar.tick({'file': file});
        });
      } else {
        self.bar.tick({file: 'DIR'});
      }
    });

  });
}

Processor.prototype.moveIndexPages = function () {
  var self = this;

  readdirRec(this.output, function( err, files ) {
    if( err ) {
        log.error( "Could not list the output directory to move index pages.", err );
        process.exit( 1 );
    }

    self.setupProgressBar(files.length, 'Moving index pages', self.fixLinks.bind(self));

    files.forEach( function( file, index ) {
      var filePath = file;

      fs.stat(filePath, function(err, stat) {
        if (err) throw err;

        if (stat.isFile()) {
          var filename = path.basename(file, '.md');

          var dirs = find.dirSync(filename, self.output);

          if (dirs.length == 1) {
            var dest = path.join(dirs[0], 'index.md');

            // fix link
            var search = path.relative(self.output, path.join(path.dirname(file), path.basename(file, '.md') + '.html'));
            var link = _.findWhere(self.movedLinks, { newLink: search });
            link.newLink = path.relative(self.output, path.join(dirs[0], 'index.html'));

            fs.renameSync(file, path.join(dirs[0], 'index.md'));

            self.bar.tick({file: filename});
          } else {
            self.bar.tick({file: filename});
          }

        } else {
          self.bar.tick({file: 'DIR'});
        }
      });
    });

  });
}

Processor.prototype.fixLinks = function () {
  var self = this;

  readdirRec(this.output, function( err, files ) {
    if( err ) {
        log.error( "Could not list the output directory to move index pages.", err );
        process.exit( 1 );
    }

    self.setupProgressBar(files.length, 'Fixing moved links');

    files.forEach( function( file, index ) {
      var filePath = file;

      fs.stat(filePath, function(err, stat) {
        if (err) throw err;

        if (stat.isFile()) {
          var filename = path.basename(file, '.md');
          fs.readFile(filePath, 'utf-8', (err, data) => {
            if (err) throw err;

            var fixed = converter.fixLinks(data, self.movedLinks);
            fs.writeFileSync(file, fixed);

            self.bar.tick({file: filename});
          });
        } else {
          self.bar.tick({file: 'DIR'});
        }
      });
    });

  });
}

module.exports = Processor;
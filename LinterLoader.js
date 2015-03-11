'use strict';

var nunjucks = require('nunjucks');
var fs = require('fs');
var path = require('path');

// Node <0.7.1 compatibility
var existsSync = fs.existsSync || path.existsSync;

var LinterLoader = function(opts) {};
LinterLoader.prototype.getSource = function(name) {
    var fullpath = null;
    var paths = this.searchPaths;

    for(var i=0; i<paths.length; i++) {
        var basePath = path.resolve(paths[i]);
        var p = path.resolve(paths[i], name);

        // Only allow the current directory and anything
        // underneath it to be searched
        if(p.indexOf(basePath) === 0 && existsSync(p)) {
            fullpath = p;
            break;
        }
    }

    if(!fullpath) {
        return null;
    }

    this.pathsToNames[fullpath] = name;

    return { src: 'sldkjfklsdjf' + fs.readFileSync(fullpath, 'utf-8') + 'sldkfjlsdj lfs dfjls ',
             path: fullpath + 'skdlfj',
             noCache: this.noCache };
};


module.exports = {
    LinterLoader: LinterLoader
};
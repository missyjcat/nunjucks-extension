var nunjucks = require('nunjucks');
var LinterLoader = require('./LinterLoader').LinterLoader;
var fs = require('fs');

// var LinterLoader = function(opts) {};

// LinterLoader.prototype.getSource = function(name) {
//     return {
//         src: 'uhm,' + fs.readFileSync(__dirname + '/templates/testing.html', 'utf-8'),
//         path: __dirname + '/templates/testing.html',
//         noCache: true
//     };
// };


// var LinterLoader = nunjucks.Loader.extend({
//     getSource: function(name) {
//         return {
//             src: 'Meeeep.',
//             path: ''
//         };
//     }
// });

var env = new nunjucks.Environment(new LinterLoader('templates'));

module.exports = function(grunt) {
    grunt.loadNpmTasks('grunt-nunjucks');

    grunt.initConfig({
        nunjucks: {
            precompile: {
                baseDir: 'templates/',
                src: 'templates/*',
                dest: 'static/js/templates.js',
                options: {
                    env: env
                }
            }
        }
    });
};
var nunjucks = require('nunjucks');
var fs = require('fs');
var path = require('path');
var LinterLoader = require('./LinterLoader').LinterLoader;
var LinterExtension = require('./LinterExtension').LinterExtension;

var dir = __dirname + '/templates/';
var stat = fs.statSync(__dirname + '/templates/');
var files = fs.readdirSync(dir);
console.log(files);
var filepath = path.join(dir, files[0]);
var subpath = filepath.substr(path.join(dir, '/').length);
console.log('subapth: ',subpath);
console.log(fs.statSync(filepath).isDirectory());

// var walk = function(dir, done) {
//   var results = [];
//   fs.readdir(dir, function(err, list) {
//     if (err) return done(err);
//     var pending = list.length;
//     if (!pending) return done(null, results);
//     console.log(list);
//     list.forEach(function(file) {
//       file = path.resolve(dir, file);
//       fs.stat(file, function(err, stat) {
//         if (stat && stat.isDirectory()) {
//           walk(file, function(err, res) {
//             results = results.concat(res);
//             if (!--pending) done(null, results);
//           });
//         } else {
//           results.push(file);
//           if (!--pending) done(null, results);
//         }
//       });
//     });
//   });
// };
// var filez;

// walk(dir, function(e, r) {
//     filez = r;
// });

// var env = nunjucks.configure();
// console.log(__dirname + '/templates/testing.html');
// nunjucks.precompile(__dirname + '/templates');


// // nunjucks.precompileString('helllloooo', {
// //     name: __dirname + '/templates',
// //     env: env    
// // });

var env = new nunjucks.Environment([new LinterLoader('templates')]);
env.addExtension('LinterExtension', new LinterExtension());
var hi = env.getTemplate('testing.html');
console.log(hi.render());

// var hi = nunjucks.precompile(__dirname + '/templates/', { env: env, include: ['testing.html'] });
// console.log(hi);

// var hi = nunjucks.compile('hey', env);
// console.log(hi.render());
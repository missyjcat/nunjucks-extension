var nunjucks = require('nunjucks');

/**
 * Custom Nunjucks loader that wraps the template source in {% lint %} {% endlint %}
 * tags so that the LintExtension can process the templates. Also a sneaky way to
 * pass our parse the filename, something that isn't supported natively.
 */
var LinterLoader = nunjucks.FileSystemLoader.extend({
    init: function(searchPaths) {
        nunjucks.FileSystemLoader.prototype.init(searchPaths);
    },

    getSource: function(name) {

        var obj = nunjucks.FileSystemLoader.prototype.getSource(name);
        obj.src = '{% lint "' + name + '" %}' + obj.src + '{% endlint %}';
        return obj;
    }
});

module.exports.LinterLoader = LinterLoader;

var nunjucks = require('nunjucks');

var LinterLoader = nunjucks.FileSystemLoader.extend({
    init: function(searchPaths) {
        nunjucks.FileSystemLoader.prototype.init(searchPaths);
    },

    getSource: function(name) {
        
        var obj = nunjucks.FileSystemLoader.prototype.getSource(name);
        obj.src = '{% lint %}' + obj.src + '{% endlint %}';
        // obj.src = '- lint -' + obj.src + '- endlint -';
        return obj;
    }
});


module.exports = {
    LinterLoader: LinterLoader
};
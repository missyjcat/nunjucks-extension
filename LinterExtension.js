var LinterExtension = function() {
    this.tags = ['lint'];

    /**
    * Parse the token stream for inspect tags
    * @param  {Object} parser the nunjucks parser
    * @param  {Object} nodes the nunjucks nodes object
    * @param  {Object} lexer the nunjucks lexer
    * @return {Object} a valid nunjucks node
    */
    this.parse = function(parser, nodes, lexer) {
        console.log(parser);
        console.log(nodes);
        console.log(lexer);
        return nodes.Value()
    };
};

module.exports.LinterExtension = LinterExtension;
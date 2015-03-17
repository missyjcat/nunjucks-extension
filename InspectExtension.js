/**
 * @fileOverview This file has the nunjucks {% inspect %} implementation for
 * inspecting how existing nunjucks nodes are constructed. This is very useful
 * when creating a new nunjucks extension (start by creating the jinja
 * representation of what you're trying to accomplish and then reproduce
 * the node structure within your template):
 *
 *     {% inspect %}{% extends "desktop/Button/Button.html" %}{% endinspect %}
 *
 * This will provide you with a dump of the node structure:
 *
 *      ROOT: Node,NodeList
 *        children:0: Node,Extends
 *          template: Node,Value,Literal
 *
 * In this case:
 *   - the Root node is an instance of both Node and NodeList (which has a children array)
 *   - the first child is an instance of both Extends and Node. It has a template parameter
 *   - the template parameter is filled by a node which is an instance of Node, Value, and
 *         Literal
 *
 * @author jstanley
 * @version 0.1
 */

/**
 * Nunjucks extension to handle {% inspect %} tags
 * @constructor
 */
var InspectExtension = function () {

    this.tags = ['inspect'];

    /**
     * Get all of the node types for a given node
     * @param  {Object.<string,Function>} nodes the nodes object provide to parse()
     * @param  {Object} node the node to be tested
     * @return {Array.<string>} an array of matching node type names
     */
    this.getNodeTypes = function (nodes, node) {
        var types = [];
        var keys = Object.keys(nodes);
        for (var j = 0; j < keys.length; j++) {
            if(node instanceof nodes[keys[j]]) {
                types.push(keys[j]);
            }
        }
        return types;
    };

    /**
     * Recursively prints valid node types to the console for an array of nodes
     * @param  {Array.<Object>} nodes the nodes object provided to parse()
     * @param  {Object} node the root node to test (likely a NodeList)
     * @param  {string} name the name of the current module
     * @param  {string} indent the current indentation string
     */
    this._showNodeTypes = function (nodes, node, name, indent) {
        if (Array.isArray(node)) {
            for (var i = 0; i < node.length; i++) {
                this._showNodeTypes(nodes, node[i], name + ':' + i, indent);
            }
        }
        var types = this.getNodeTypes(nodes, node);
        if (types.length) {
            console.log(indent + name + ': ' + types.join(','));
            indent = indent + '  ';
            for (var key in node) {
                this._showNodeTypes(nodes, node[key], key, indent);
            }
        }
    };

    /**
     * Parse the token stream for inspect tags
     * @param  {Object} parser the nunjucks parser
     * @param  {Object} nodes the nunjucks nodes object
     * @param  {Object} lexer the nunjucks lexer
     * @return {Object} a valid nunjucks node
     */
    this.parse = function (parser, nodes, lexer) {
        parser.nextToken();
        parser.skip(lexer.TOKEN_BLOCK_END);
        var inspectNodes = parser.parseUntilBlocks('endinspect');
        this._showNodeTypes(nodes, inspectNodes, 'ROOT', '');
        parser.advanceAfterBlockEnd();
        return new nodes.NodeList();
    };

};

module.exports.InspectExtension = InspectExtension;

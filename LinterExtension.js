/**
 * @fileOverview This file has the nunjucks {% lint %} implementation for applying
 * ESLint-style rules to Nunjucks template.
 *
 * @author jchan
 * @version 0.1
 */

var path = require('path');
var fs = require('fs');

/**
 * ESLint-style linter for Nunjucks templates
 * @param {string} rulesDirectory Path to the rules directory
 */
var LinterExtension = function(rulesDirectory) {

    this.tags = ['lint'];
    this.app = null;
    this._rules = {};
    this.context = {
        comments: []
    };

    var ALLOWED_TARGETS = ['Node', 'Root', 'NodeList', 'Value', 'Literal', 'Symbol',
        'Group', 'Array', 'Pair', 'Dict', 'Output', 'TemplateData', 'If', 'IfAsync',
        'InlineIf', 'For', 'AsyncEach', 'AsyncAll', 'Macro', 'Caller', 'Import',
        'FromImport', 'FunCall', 'Filter', 'FilterAsync', 'KeywordArgs', 'Block',
        'Super', 'Extends', 'Include', 'Set', 'LookupVal', 'BinOp', 'In', 'Or',
        'And', 'Not', 'Add', 'Sub', 'Mul', 'Div', 'FloorDiv', 'Mod', 'Pow', 'Neg',
        'Pos', 'Compare', 'CompareOperand', 'CallExtension', 'CallExtensionAsync'];

    /**
     * Returns new value without ":exit" if present from a key
     * @param  {String} target 
     * @return {String}        
     */
    var sliceExit = function(target) {
        var sliceResult = target.indexOf(':exit');
        if (sliceResult > -1) {
            return target.slice(0, sliceResult);
        }
        return target;
    };

    /**
     * Returns new string value with ":exit" if not already present
     * @param {String} target
     * @return {String} 
     */
    var addExit = function(target) {
        if (target.indexOf(':exit') === -1) {
            return target + ':exit';
        }
        return target;
    };

    /**
     * Given a node return its type
     * @param  {Object} Nunjucks node object 
     * @param  {Node} node  
     * @return {String}
     */
    var getNodeTypes = function(nodes, node) {
        if (!node) {
            return;
        }
        var nodeTypes = Object.keys(nodes);
        var types = [];
        for (i = 0; i < nodeTypes.length; i++) {
            if (node instanceof nodes[nodeTypes[i]]) {
                types.push(nodeTypes[i]);
            }
        }
        return types;
    };

    /**
     * Execute functions for a given NodeType given an array of rules
     * @param  {Array} rules
     * @param  {Object} node
     * @return
     */
    var executeRulesOnNode = function(rules, node) {
        if (rules && rules.length) {
            for (i = 0; i < rules.length; i++) {
                rules[i](node);
            }
        }
        return;
    };

    // Add target keys to rules map
    for (var i = 0; i < ALLOWED_TARGETS.length; i++) {
        this._rules[ALLOWED_TARGETS[i]] = [];
        this._rules[ALLOWED_TARGETS[i] + ":exit"] = [];
    }

    // Get an array of the rule filenames we're working with
    var rulesPath = path.resolve(rulesDirectory);
    var rulesFiles = fs.readdirSync(rulesPath);

    // Loop through each file 
    var tempMap;
    for (i = 0; i < rulesFiles.length; i++) {

        // Store returned dict of rules in a temporary map
        tempMap = require(rulesPath + '/' + rulesFiles[i])();

        // For each rule, verify it's an allowed target and store it in our rules
        for (key in tempMap) {
            if (ALLOWED_TARGETS.indexOf(sliceExit(key)) === -1) {
                
                // If there are any rules that this linter doesn't support, throw an
                // error.
                throw Error(key + ' is not an allowed target for a rule. See ' +
                    rulesFiles[i]);
            }

            this._rules[key].push(tempMap[key]);
        }
    }

    /**
     * Set the app name to include in context information
     * @param {String} app 
     */
    this.setApp = function(app) {
        this.app = app;
    };

    /**
     * In-order traversal of the template's AST from the root, applying rules as
     * we enter and exit the functions
     * @param  {Object} nodes   Nunjucks nodes object
     * @param  {Object} nodeTreeRoot
     */
    this._traverseTreeAndExecRules = function(nodes, nodeTreeRoot) {
        var root = nodeTreeRoot;
        var current = null;
        var state = [];
        // entering a node
        console.log('entering: ', getNodeTypes(nodes, root));
        console.log(root);
        var types = getNodeTypes(nodes, root);
        var ruleKeys = Object.keys(this._rules);
        // Get the types of this node and loop through our rules.
        for (i = 0; i < types.length; i++) {
            // console.log('Types are: ' + types[i]);
            if (this._rules[types[i]].length) {
                console.log('executing... ' + types[i]);
                executeRulesOnNode(this._rules[types[i]], root);
            }
        }
        // this._rules['Set'][0](root.children[0]);
        // console.log("root child length: ", root.children && root.children[1]);
        if (root.children && root.children.length) {
            console.log('I have ' + root.children.length);
            for (var j = 0; j < root.children.length; j++) {
                this._traverseTreeAndExecRules(nodes, root.children[j]);
            }
            console.log('exiting a parent node: ', getNodeTypes(nodes, root));
        } else {
            // exiting a childless node
            console.log('exiting a childless node: ', getNodeTypes(nodes, root));
            for (var k = 0; k < types.length; k++) {
                if (this._rules[types[k] + ':exit'].length) {
                    executeRulesOnNode(this._rules[types[k] + ':exit'], root);
                }
            }
        }
        return;
    };

    /**
    * Parse the token stream for lint tags and when it hits one, get the root and
    * pass it to our tree traverser to execute the rules.
    * @param  {Object} parser the nunjucks parser
    * @param  {Object} nodes the nunjucks nodes object
    * @param  {Object} lexer the nunjucks lexer
    * @return {Object} a valid nunjucks node
    */
    this.parse = function(parser, nodes, lexer) {

        // Skip the beginning {% lint %} tag
        console.log(parser.nextToken());
        parser.skip(lexer.TOKEN_BLOCK_END);

        // Might want to manually parse token by token to build up a tree that has
        // manually inserted information for comments
        console.log(lexer);

        var storedComment = [];

        do {
            if (parser.peekToken()) {
                var curr = parser.peekToken();
                switch(curr.type) {
                
                case 'comment':
                    // A comment just happened. Cache it so that the next node we
                    // encounter picks it up as its leading comment.
                    storedComment.push(curr);

                    // Add this comment to our context so that we can get all comments
                    // in this source also.
                    this.context.comments.push(curr);

                    break;
                
                }
                
                console.log('token: ', curr);
                parser.parseSignature(null, false);
                // var node = parser.parse();
                // console.log('node: ', node);
            }
        }
        while(parser.nextToken())

        // Gets the root of the tree with references to children
        var root = parser.parseUntilBlocks('endlint');

        // Traverse the tree
        // this._traverseTreeAndExecRules(nodes, root);

        // Skip the ending {% endlint %} tag
        // parser.nextToken();
        // parser.skip(lexer.TOKEN_BLOCK_END);

        // return root;

    };

};

module.exports.LinterExtension = LinterExtension;
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

    var ALLOWED_TARGETS = ['Node', 'Root', 'NodeList', 'Value', 'Literal', 'Symbol',
        'Group', 'Array', 'Pair', 'Dict', 'Output', 'TemplateData', 'If', 'IfAsync',
        'InlineIf', 'For', 'AsyncEach', 'AsyncAll', 'Macro', 'Caller', 'Import',
        'FromImport', 'FunCall', 'Filter', 'FilterAsync', 'KeywordArgs', 'Block',
        'Super', 'Extends', 'Include', 'Set', 'LookupVal', 'BinOp', 'In', 'Or',
        'And', 'Not', 'Add', 'Sub', 'Mul', 'Div', 'FloorDiv', 'Mod', 'Pow', 'Neg',
        'Pos', 'Compare', 'CompareOperand', 'CallExtension', 'CallExtensionAsync'];

    // Add target keys to rules map
    for (var i = 0; i < ALLOWED_TARGETS.length; i++) {
        this._rules[ALLOWED_TARGETS[i]] = [];
        this._rules[ALLOWED_TARGETS[i] + ":exit"] = [];
    }

    // Store the directory listing
    var rulesPath = path.resolve(rulesDirectory);
    var rulesFiles = fs.readdirSync(rulesPath);
    // console.log(rulesPath, rulesFiles);

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
     */
    var addExit = function(target) {
        if (target.indexOf(':exit') === -1) {
            return target + ':exit';
        }
        return target;
    }

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
     * Execute functions for a given NodeType given an array of rules
     * @param  {Array} rules
     * @param  {Object} node
     * @return
     */
    this._executeRulesOnNode = function(rules, node) {
        if (rules && rules.length) {
            for (i = 0; i < rules.length; i++) {
                console.log('running a rule on ' + node);
                rules[i](node);
            }
        }
        return;
    };

    // Set the app to include in the context
    this.setApp = function(app) {
        this.app = app;
    };

    this._getNodeTypes = function(nodes, node) {
        if (!node) {
            return;
        }
        var nodeTypes = Object.keys(nodes);
        // Need to get rid of printNodes
        nodeTypes.splice(nodeTypes.indexOf('printNodes'), 1);
        // console.log(nodeTypes);
        var types = [];
        for (i = 0; i < nodeTypes.length; i++) {
            if (node instanceof nodes[nodeTypes[i]]) {
                types.push(nodeTypes[i]);
            }
        }
        return types;
    };

    /**
     * In-order traversal of the template's AST from the root, applying rules as
     * we enter and exit the functions
     * @param  {Object} nodes
     * @param  {Object} nodeTreeRoot
     */
    this._traverseTreeAndExecRules = function(nodes, nodeTreeRoot) {
        var root = nodeTreeRoot;
        var current = null;
        var state = [];
        // entering a node
        console.log('entering: ', this._getNodeTypes(nodes, root));
        console.log(root);
        var types = this._getNodeTypes(nodes, root);
        var ruleKeys = Object.keys(this._rules);
        // Get the types of this node and loop through our rules.
        for (i = 0; i < types.length; i++) {
            // console.log('Types are: ' + types[i]);
            if (this._rules[types[i]].length) {
                console.log('executing... ' + types[i]);
                this._executeRulesOnNode(this._rules[types[i]], root);
            }
        }
        // this._rules['Set'][0](root.children[0]);
        // console.log("root child length: ", root.children && root.children[1]);
        if (root.children && root.children.length) {
            console.log('I have ' + root.children.length);
            for (var j = 0; j < root.children.length; j++) {
                this._traverseTreeAndExecRules(nodes, root.children[j]);
            }
            console.log('exiting a parent node: ', this._getNodeTypes(nodes, root));
        } else {
            // exiting a childless node
            console.log('exiting a childless node: ', this._getNodeTypes(nodes, root));
            for (var k = 0; k < types.length; k++) {
                if (this._rules[types[k] + ':exit'].length) {
                    this._executeRulesOnNode(this._rules[types[k] + ':exit'], root);
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
        parser.nextToken();
        parser.skip(lexer.TOKEN_BLOCK_END);

        // Might want to manually parse token by token to build up a tree that has
        // manually inserted information for comments

        // Gets the root of the tree with references to children
        var root = parser.parseUntilBlocks('endlint');
        // console.log(this._getNodeTypes(root), root);
        // console.log(root.children[0].children[0]);
        // console.log(this._getNodeTypes(nodes, root.children[0].children[0]));

        // Traverse the tree
        this._traverseTreeAndExecRules(nodes, root);
        

    };

};

module.exports.LinterExtension = LinterExtension;
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
        _comments: [],
        _sourceCode: {},

        getAllComments: function() {

        },

        getSource: function(node) {
            var out = '';
            for (key in this._sourceCode) {
                out += this._sourceCode[key].join(' ') + '\n';
            }
            return out;
        }, 

        getSurroundingSource: function(node, lines) {

        },

        getLineNumber: function(node) {
            return node.lineno + 1;
        }
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
     * @return {Array}
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
     * Given a node return its constructor
     * @param  {Node} node  
     * @return {Object}
     */
    var getNodeConstructor = function(node) {
        if (!node) {
            return;
        }
        return node.constructor.prototype;
    }

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
        tempMap = require(rulesPath + '/' + rulesFiles[i])(this.context);

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
            for (var k = 0; k < types.length; k++) {
                if (this._rules[types[k] + ':exit'].length) {
                    executeRulesOnNode(this._rules[types[k] + ':exit'], root);
                }
            }
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

        // The parser that is passed to this function already has a Tokenizer
        // instance doing it's thing. But we want to create an independent
        // parser with its own Tokenizer instance to do some source code indexing
        var Tokenizer = parser.tokens.constructor;
        Tokenizer.prototype = parser.tokens.constructor.prototype;
        var Parser = parser.constructor;
        Parser.prototype = parser.constructor.prototype;
        
        // Construct the current Tokenizer instance's opts
        var opts = {
            tags: parser.tokens.tags,
            trimBlocks: parser.tokens.trimBlocks,
            lstripBlocks: parser.tokens.lstripBlocks
        };

        var altTokens = new Tokenizer(parser.tokens.str, opts);

        var altParser = new Parser(altTokens);

        var storedComments = [];
        var sourceCode = {};

        var addToSourceDict = function(tok) {
            // Adding one because tokens seem to be zero-indexed
            var lineNo = curr.lineno + 1;
            if (sourceCode[lineNo]) {
                sourceCode[lineNo].push(curr.value)
            } else {
                sourceCode[lineNo] = [curr.value];
            }
        };

        // Skip the beginning {% lint %} tag
        altParser.nextToken();
        altParser.nextToken();
        altParser.nextToken();
        var curr = altParser.nextToken();
        var done = false;
        do {
            if (altParser.peekToken() && !done) {
                var peek = altParser.peekToken();
                console.log('curr: ', curr);
                console.log('peek: ', peek);
                switch(curr.type) {
                
                case 'comment':
                    // A comment just happened. Store them in an array so that context
                    // can access them.
                    storedComments.push(curr);

                    // Store this in our source code dict
                    console.log('comment: ', curr);
                    addToSourceDict(curr);
                    break;
                case 'block-start':
                    // Skipping the endlint tag so it doesn't show up in our souce
                    if (peek.value === 'endlint') {
                        done = true;
                    }
                    break;
                default:
                    console.log(curr);
                    addToSourceDict(curr)
                    break;
                }
            }

        }
        while(curr = altParser.nextToken())

        this.context._comments.concat(storedComments);
        this.context._sourceCode = sourceCode;

        console.log('source: ', this.context._sourceCode);
        console.log('allComments: ', storedComments);

        // Starting the actual parsing and linting

        // Skip the beginning {% lint %} tag
        parser.nextToken();
        parser.nextToken();
        var root = parser.parseUntilBlocks('endlint');

        // Traverse the tree
        this._traverseTreeAndExecRules(nodes, root);

        // Skip the ending {% endlint %} tag
        parser.nextToken();
        parser.nextToken();

        return root;

    };

};

module.exports.LinterExtension = LinterExtension;
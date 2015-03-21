var fs = require('fs');
var path = require('path');
var grunt = require('grunt');

/**
 * @fileOverview This file has the nunjucks {% lint %} implementation for
 * traversing Nunjucks ASTs and either linting or performing other operations.
 *
 * TODO(jchan): Currently not suitable for compile-time environments since it depends on
 * a custom loader (LinterLoader) to inject {% lint %}{% endlint %} tags automaticaly
 * which invokes this extension. Nunjucks compile and precompile doesn't take a custom Loader.
 * Look into another way to do this.
 *
 * @author jchan
 * @version 0.1
 */

/**
 * ESLint-style linter for Nunjucks templates
 * @param {string} rulesDirectory Path to the rules directory
 */
var LinterExtension = function(rulesDirectory) {

    var ALLOWED_TARGETS = ['Node', 'Root', 'NodeList', 'Value', 'Literal', 'Symbol',
        'Group', 'Array', 'Pair', 'Dict', 'Output', 'TemplateData', 'If', 'IfAsync',
        'InlineIf', 'For', 'AsyncEach', 'AsyncAll', 'Macro', 'Caller', 'Import',
        'FromImport', 'FunCall', 'Filter', 'FilterAsync', 'KeywordArgs', 'Block',
        'Super', 'Extends', 'Include', 'Set', 'LookupVal', 'BinOp', 'In', 'Or',
        'And', 'Not', 'Add', 'Sub', 'Mul', 'Div', 'FloorDiv', 'Mod', 'Pow', 'Neg',
        'Pos', 'Compare', 'CompareOperand', 'CallExtension', 'CallExtensionAsync'];

    var i;

    /**
     * Returns new value without ":exit" if present from a key
     * @param  {String} target
     * @return {String}
     */
    var _sliceExit = function(target) {
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
    var _addExit = function(target) {
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
    var _getNodeTypes = function(nodes, node) {
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
    var _getNodeConstructor = function(node) {
        if (!node) {
            return;
        }
        return node.constructor.prototype;
    };

    /**
     * Execute functions for a given NodeType given an array of rules
     * @param  {Array} rules
     * @param  {Object} node
     * @return
     */
    var _executeRulesOnNode = function(rules, node) {
        if (rules && rules.length) {
            for (i = 0; i < rules.length; i++) {
                rules[i](node);
            }
        }
        return;
    };

    this.tags = ['lint'];
    this.app = null;
    this._rules = {};

    /**
     * This is an API that exposes some helpful information about the current
     * template and provides reporting methods. Use it in your linter files.
     */
    this.context = {

        // Populated by setAppName()
        _appName: '',

        // Populated by _processRules
        _ruleName: '',

        // Populated by parse()
        _comments: [],
        _sourceCode: {},
        _nodes: null,
        _filename: '',

        // Populated by errors
        _warnings: [],
        _logs: [],
        _fatals: [],

        /**
         * Returns the name of the current app if it has been set
         * @return {String}
         */
        getAppName: function() {
            return this._appName;
        },

        /**
         * Returns all the comments in a template as an array
         * @return {Array}
         */
        getAllComments: function() {
            return this._comments;
        },

        /**
         * Returns a string containing the source code of the template
         * @return {String}
         */
        getSource: function() {
            var out = '';
            for (var key in this._sourceCode) {
                out += this._sourceCode[key].join(' ') + '\n';
            }
            return out;
        },

        /**
         * Returns an array describing the node types of given node
         * @param  {Object} node
         * @return {Array}
         */
        getNodeTypes: function(node) {
            return _getNodeTypes(this._nodes, node);
        },

        /**
         * Returns the constructor of this node
         * @param  {Object} node
         * @return {String}
         */
        getNodeConstructor: function(node) {
            return _getNodeConstructor(node).typename;
        },

        /**
         * Gets the leading source code of the given node, up to the given number
         * of lines. No whitespace management is included so you might have to fudge
         * with this number.
         * @param  {Object} node
         * @param  {Number} lines   number of lines including the node's starting line
         * @return {String}
         */
        getLeadingSource: function(node, lines) {
            var out = '';
            var nodeLineNo = node.lineno + 1;
            var limit = nodeLineNo - lines;
            for (i = limit; i <= nodeLineNo; i++) {
                if (this._sourceCode[i]) {
                    out += this._sourceCode[i].join('');
                }
            }
            return out;
        },

        /**
         * Gets the leading source code of the given node, up to the given number
         * of lines. No whitespace management is included so you might have to fudge
         * with this number.
         * @param  {Object} node
         * @param  {Number} lines   number of lines including the node's starting line
         * @return {String}
         */
        getTrailingSource: function(node, lines) {
            var out = '';
            var nodeLineNo = node.lineno + 1;
            var limit = nodeLineNo + lines;
            for (i = nodeLineNo; i <= limit; i++) {
                if (this._sourceCode[i]) {
                    out += this._sourceCode[i].join('');
                }
            }
            return out;
        },

        /**
         * Gives access to the root so that you can start here and inspect the children
         * with getNodeConstructor() to find the node you're looking to target
         * @return {Object}
         */
        getRoot: function() {
            return this._root;
        },

        /**
         * Returns the line number of the given node
         * @param  {Object} node
         * @return {Number}
         */
        getLineNumber: function(node) {
            return node.lineno + 1;
        },

        /**
         * Returns the filename of the current template
         * @return {String}
         */
        getFilename: function() {
            return this._filename;
        },

        /**
         * Use this to output a log message in the buffer.
         * @param  {String} message
         * @param {Object} node
         */
        log: function(message, node) {
            var line = this.getLineNumber(node);
            var src = this.getLeadingSource(node, 0).replace(/(\r\n|\n|\r)/gm,' ');
            this._logs.push({
                ruleName: this._ruleName,
                message: message,
                line: line,
                src: src,
                file: this._filename
            });
        },

        /**
         * Use this to output a warning message.
         * @param  {String} message
         * @param {Object} node
         */
        warn: function(message, node) {
            var line = this.getLineNumber(node);
            var src = this.getLeadingSource(node, 0).replace(/(\r\n|\n|\r)/gm,' ');
            this._warnings.push({
                ruleName: this._ruleName,
                message: message,
                line: line,
                src: src,
                file: this._filename
            });
        },

        /**
         * Use this to output a fatal message. This will halt execution
         * @param  {String} message
         * @param {Object} node
         */
        fatal: function(message, node) {
            var line = this.getLineNumber(node);
            var src = this.getLeadingSource(node, 0).replace(/(\r\n|\n|\r)/gm,' ');
            this._fatals.push({
                ruleName: this._ruleName,
                message: message,
                line: line,
                src: src,
                file: this._filename
            });
        }
    };

    this._processRules = function() {
        // Add target keys to rules map
        for (i = 0; i < ALLOWED_TARGETS.length; i++) {
            this._rules[ALLOWED_TARGETS[i]] = [];
            this._rules[_addExit(ALLOWED_TARGETS[i])] = [];
        }

        // Get an array of the rule filenames we're working with
        var rulesPath = path.resolve(rulesDirectory);
        var rulesFiles = fs.readdirSync(rulesPath);

        // Loop through each file
        var fnCheck;
        var tempMap;
        for (i = 0; i < rulesFiles.length; i++) {

            // Put the name of the filename in the context object
            this.context._ruleName = rulesFiles[i];

            // Store returned dict of rules in a temporary map
            fnCheck = require(rulesPath + '/' + rulesFiles[i]);
            if (typeof(fnCheck) === 'function') {
                tempMap = fnCheck(this.context);
            } else {
                grunt.fail.warn(rulesFiles[i] + ' is not exporting a function.');
            }

            // For each rule, verify it's an allowed target and store it in our rules
            for (var key in tempMap) {
                if (ALLOWED_TARGETS.indexOf(_sliceExit(key)) === -1) {

                    // If there are any rules that this linter doesn't support, throw an
                    // error.
                    grunt.fail.warn('"' + key + '"' + ' is not an allowed target for a rule. See ' +
                        rulesFiles[i]);
                }

                this._rules[key].push(tempMap[key]);
            }
        }
    };

    /**
     * Set the app name to include in context information
     * @param {String} app
     */
    this.setAppName = function(app) {
        this.context._appName = app;
    };

    /**
     * In-order traversal of the template's AST from the root, applying rules as
     * we enter and exit the nodes
     * @param  {Object} nodes   Nunjucks nodes object
     * @param  {Object} nodeTreeRoot
     * @private
     */
    this._traverseTreeAndExecRules = function(nodes, nodeTreeRoot) {
        var root = nodeTreeRoot;
        var current = null;
        var state = [];
        var types = _getNodeTypes(nodes, root);
        var ruleKeys = Object.keys(this._rules);
        var j, k;

        var _exitAndExec = function(rules, types, root) {
            for (k = 0; k < types.length; k++) {
                exitType = _addExit(types[k]);
                if (rules[exitType].length) {
                    _executeRulesOnNode(_rules[exitType], root)
                }
            }
        };

        // Entering a node
        // Get the types of this node and loop through our rules.
        for (i = 0; i < types.length; i++) {
            if (this._rules[types[i]].length) {
                _executeRulesOnNode(this._rules[types[i]], root);
            }
        }

        // Now examining node children by type
        // TODO(jchan): Confirm all of the types that Nunjucks supports
        switch (_getNodeConstructor(root).typename) {

        // If has no children, but rather branches and bodies
        case 'If':
            if (root.cond) {
                this._traverseTreeAndExecRules(nodes, root.cond);
            }

            if (root.body) {
                this._traverseTreeAndExecRules(nodes, root.body);
            }

            if (root.else_) {
                this._traverseTreeAndExecRules(nodes, root.else_);
            }

            // Exiting If node
            _exitAndExec(this._rules, types, root);
            break;

        case 'FunCall':
            if (root.args) {
                this._traverseTreeAndExecRules(nodes, root.args);
            }

            // Exiting FunCall node
            _exitAndExec(this._rules, types, root);

            break;

        case 'Pair':
            if (root.value) {
                this._traverseTreeAndExecRules(nodes, root.value);
            }

            // Exiting Pair node
            _exitAndExec(this._rules, types, root);

            break;

        case 'Macro':
            if (root.args) {
                this._traverseTreeAndExecRules(nodes, root.args);
            }

            if (root.body) {
                this._traverseTreeAndExecRules(nodes, root.body);
            }

            // Exiting Macro node
            _exitAndExec(this._rules, types, root);
            break;

        default:
            if (root.children && root.children.length) {

                for (j = 0; j < root.children.length; j++) {
                    this._traverseTreeAndExecRules(nodes, root.children[j]);
                }

                // Exiting a parent node
                _exitAndExec(this._rules, types, root);

            } else {

                // Exiting a childless node
                _exitAndExec(this._rules, types, root);
            }
            break;
        }

        return;
    };

    /**
     * Collects and reports the errors that have occurred
     * @private
     */
     this._reportErrors = function() {
        var logs = this.context._logs;
        var warnings = this.context._warnings;
        var fatals = this.context._fatals;
        var i;

        var logOut = '';
        var warnOut = '';
        var fatalOut = '';

        for (i = 0; i < logs.length; i++) {
            var log = logs[i];
            logOut += log.ruleName + '\n' +
                'LOG: ' + 'line ' + log.line + ' in ' + log.file + ', ' + log.message + '\n' +
                log.src + '\n\n';
        }

        for (i = 0; i < warnings.length; i++) {
            var warning = warnings[i];
            warnOut += warning.ruleName + '\n' +
                'WARN: ' + 'line ' + warning.line + ' in ' + warning.file + ', ' + warning.message + '\n' +
                warning.src + '\n\n';
        }

        for (i = 0; i < fatals.length; i++) {
            var fatal = fatals[i];
            fatalOut += fatal.ruleName + '\n' +
                'FATAL: ' + 'line ' + fatal.line + ' in ' + fatal.file + ', ' + fatal.message + '\n' +
                fatal.src + '\n\n';
        }


        // Prioritizing this way so that log messages always get spit out, fatal will
        // halt execution and mask any warnings; if warnings are there they won't mask
        // fatals.
        if (logOut) {
            grunt.log.subhead(logOut);
        }

        if (fatalOut) {
            grunt.fail.fatal(fatalOut);
        }

        if (warnOut) {
            grunt.fail.warn(warnOut);
        }

     };

    /**
    * Parse the token stream to get structured data from it to pass to our context
    * and then to traverse the AST and apply rules to nodes.
    * @param  {Object} parser the nunjucks parser
    * @param  {Object} nodes the nunjucks nodes object
    * @param  {Object} lexer the nunjucks lexer
    * @return {Object} a valid nunjucks node
    */
    this.parse = function(parser, nodes, lexer) {

        // Stash a reference of nodes so that our context can know about it
        this.context._nodes = nodes;

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

        // Create new instances of the above classes to get our metadata
        var altTokens = new Tokenizer(parser.tokens.str, opts);
        var altParser = new Parser(altTokens);

        var storedComments = [];
        var sourceCode = {};

        /**
         * Add this token's source code to our source dictionary
         * @param {Object} tok
         */
        var addToSourceDict = function(tok) {
            // Adding one because tokens seem to be zero-indexed
            var lineNo = tok.lineno + 1;
            if (sourceCode[lineNo]) {
                sourceCode[lineNo].push(tok.value);
            } else {
                sourceCode[lineNo] = [tok.value];
            }
        };

        // Point the altParser to the arguments token and parse the signature to
        // get the filename. Can add more args to this linter if needed in the future.
        altParser.nextToken();
        var curr = altParser.nextToken();
        var fileName = altParser.parseSignature(null, true).children[0].value;
        altParser.advanceAfterBlockEnd(curr.value);
        curr = altParser.nextToken();
        altParser.nextToken();

        // Adding filename to context to make available to linters
        this.context._filename = fileName;

        var done = false;
        do {
            if (altParser.peekToken() && !done) {
                var peek = altParser.peekToken();
                switch(curr.type) {

                case 'comment':
                    // A comment just happened. Store them in an array so that context
                    // can access them.
                    storedComments.push(curr);

                    // Store this in our source code dict
                    addToSourceDict(curr);
                    break;
                case 'block-start':
                    // Skipping the endlint tag so it doesn't show up in our souce
                    if (peek.value === 'endlint') {
                        done = true;
                    } else {
                        addToSourceDict(curr);
                    }
                    break;
                default:
                    addToSourceDict(curr);
                    break;
                }
            }

        }
        while((curr = altParser.nextToken()));

        // Populate our context with comments and source code
        this.context._comments = storedComments;
        this.context._sourceCode = sourceCode;

        // Now starting the actual parsing
        // Skip the beginning {% lint "filename" %} tag
        parser.nextToken(); // lint
        parser.nextToken(); // string
        parser.nextToken(); // %}
        var root = parser.parseUntilBlocks('endlint');
        this.context._root = root;

        // Process our rules
        this._processRules();

        // Traverse the tree
        this._traverseTreeAndExecRules(nodes, root);

        // Output the errors
        this._reportErrors();

        // Skip the ending {% endlint %} tag
        parser.nextToken();
        parser.nextToken();

        return root;

    };

};


module.exports.LinterExtension = LinterExtension;

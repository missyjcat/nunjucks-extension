module.exports = function(context) {
    return {
        "Set": function(node) {
            // Check to see what the value of the node is
            console.log('im in a rule!: ' + node);
            console.log(node);
            console.log('SOURCE: ',context.getSource());
            console.log(context.getApp());
            for (var i = 0; i < node.targets.length; i++) {
                if (node.targets[i].value === 'hey') {
                    // throw Error("Bummer, you can't use hey as a variable name.");
                    context.warn('bummer... broke a rule');
                }
            }
            return;
        },

        "Set:exit": function(node) {
            console.log('dont mind me just exiting a rule...');
            return;
        }
    };
};
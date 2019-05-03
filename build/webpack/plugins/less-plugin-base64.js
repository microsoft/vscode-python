// Most of this was based on https://github.com/less/less-plugin-inline-urls
// License for this was included in the ThirdPartyNotices-Repository.txt
const less = require('less');

class Base64MimeTypeNode {
    constructor() {
        this.value = "image/svg+xml;base64";
        this.type = "Base64MimeTypeNode";
    }

    eval(context) {
        return this;
    }
}

class Base64Visitor {

    constructor() {
        this.visitor = new less.visitors.Visitor(this);

        // Set to a preEval visitor to make sure this runs before
        // any evals
        this.isPreEvalVisitor = true;

        // Make sure this is a replacing visitor so we remove the old data.
        this.isReplacing = true;
    }

    run(root) {
        return this.visitor.visit(root);
    }

    visitUrl(URLNode, visitArgs) {
        // Return two new nodes in the call. One that has the mime type and other with the node. The data-uri
        // evaluator will transform this into a base64 string
        return new less.tree.Call("data-uri", [new Base64MimeTypeNode(), URLNode.value], URLNode.index || 0, URLNode.currentFileInfo);
    }

}

class Base64Plugin {
    constructor() {
    }

    install(less, pluginManager) {
        pluginManager.addVisitor(new Base64Visitor());
    }

    printUsage() {
        console.log('Base64 Plugin. Add to your webpack.config.js as a plugin to convert URLs to base64 inline')
    }
}

module.exports = Base64Plugin;

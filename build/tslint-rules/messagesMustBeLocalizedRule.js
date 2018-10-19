// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const Lint = require("tslint");
const ts = require("typescript");
const constants_1 = require("../constants");
const methodNames = [
    // From IApplicationShell (vscode.window)
    'showErrorMessage', 'showInformationMessage',
    'showWarningMessage', 'setStatusBarMessage',
    // From IOutputChannel (vscode.OutputChannel)
    'appendLine', 'appendLine'
];
const failureMessage = 'Messages must be locaclized in the Python Extension';
class NoStringLiteralsInMessages extends Lint.RuleWalker {
    constructor() {
        super(...arguments);
        this.filesToIgnore = constants_1.getListOfExcludedFiles();
    }
    visitCallExpression(node) {
        const sourceFile = node.getSourceFile();
        const prop = node.expression;
        if (sourceFile && sourceFile.fileName && this.filesToIgnore.indexOf(sourceFile.fileName) === -1 &&
            ts.isPropertyAccessExpression(node.expression) &&
            methodNames.indexOf(prop.name.text) >= 0) {
            node.arguments
                .filter(arg => ts.isStringLiteral(arg) || ts.isTemplateLiteral(arg))
                .forEach(arg => {
                this.addFailureAtNode(arg, failureMessage);
            });
        }
        super.visitCallExpression(node);
    }
}
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        return this.applyWithWalker(new NoStringLiteralsInMessages(sourceFile, this.getOptions()));
    }
}
Rule.FAILURE_STRING = failureMessage;
exports.Rule = Rule;

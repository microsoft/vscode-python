// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const Lint = require("tslint");
const ts = require("typescript");
const baseRuleWalker_1 = require("./baseRuleWalker");
const methodNames = [
    // From IApplicationShell (vscode.window)
    'showErrorMessage', 'showInformationMessage',
    'showWarningMessage', 'setStatusBarMessage',
    // From IOutputChannel (vscode.OutputChannel)
    'appendLine', 'appendLine'
];
const ignoredPrefix = 'src/test'.replace(/\//g, path.sep);
const failureMessage = 'Messages must be localized in the Python Extension (use src/client/common/utils/localize.ts)';
class NoStringLiteralsInMessages extends baseRuleWalker_1.BaseRuleWalker {
    visitCallExpression(node) {
        if (!this.shouldIgnoreNode(node)) {
            node.arguments
                .filter(arg => ts.isStringLiteral(arg) || ts.isTemplateLiteral(arg))
                .forEach(arg => {
                this.addFailureAtNode(arg, failureMessage);
            });
        }
        super.visitCallExpression(node);
    }
    shouldIgnoreCurrentFile(node) {
        if (super.shouldIgnoreCurrentFile(node)) {
            return true;
        }
        const sourceFile = node.getSourceFile();
        if (sourceFile && sourceFile.fileName) {
            if (sourceFile.fileName.startsWith(ignoredPrefix)) {
                return true;
            }
        }
        return false;
    }
    shouldIgnoreNode(node) {
        if (this.shouldIgnoreCurrentFile(node)) {
            return true;
        }
        if (!ts.isPropertyAccessExpression(node.expression)) {
            return true;
        }
        const prop = node.expression;
        if (methodNames.indexOf(prop.name.text) < 0) {
            return true;
        }
        return false;
    }
}
class Rule extends Lint.Rules.AbstractRule {
    apply(sourceFile) {
        return this.applyWithWalker(new NoStringLiteralsInMessages(sourceFile, this.getOptions()));
    }
}
Rule.FAILURE_STRING = failureMessage;
exports.Rule = Rule;

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
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
const failureMessage = 'Messages must be localized in the Python Extension (use src/client/common/utils/localize.ts)';
class NoStringLiteralsInMessages extends baseRuleWalker_1.BaseRuleWalker {
    visitCallExpression(node) {
        const prop = node.expression;
        if (!this.sholdIgnoreCcurrentFile(node) &&
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

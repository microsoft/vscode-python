// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

const path = require('path');
const Lint = require('tslint');
const ts = require('typescript');
const util = require('../util');
const baseRuleWalker = require('./baseRuleWalker');
const methodNames = [
    // From IApplicationShell (vscode.window):
    'showErrorMessage',
    'showInformationMessage',
    'showWarningMessage',
    'setStatusBarMessage',
    // From IOutputChannel (vscode.OutputChannel):
    'appendLine',
    'appendLine'
];
// tslint:ignore-next-line:no-suspicious-comments
// TODO: Ideally we would not ignore any files.
const ignoredFiles = util.getListOfFiles('unlocalizedFiles.json');
const ignoredPrefix = path.normalize('src/test');
const failureMessage = 'Messages must be localized in the Python Extension (use src/client/common/utils/localize.ts)';
class NoStringLiteralsInMessages extends baseRuleWalker.BaseRuleWalker {
    visitCallExpression(node) {
        if (!this.shouldIgnoreNode(node)) {
            node.arguments
                .filter((arg) => ts.isStringLiteral(arg) || ts.isTemplateLiteral(arg))
                .forEach((arg) => {
                    this.addFailureAtNode(arg, failureMessage);
                });
        }
        super.visitCallExpression(node);
    }
    shouldIgnoreCurrentFile(node) {
        //console.log('');
        //console.log(node.getSourceFile().fileName);
        //console.log(ignoredFiles);
        if (super.shouldIgnoreCurrentFile(node, ignoredFiles)) {
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

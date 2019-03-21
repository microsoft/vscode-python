// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import * as Lint from 'tslint';
import * as ts from 'typescript';
import { BaseRuleWalker } from './baseRuleWalker';

const methodNames = [
    // From IApplicationShell (vscode.window)
    'showErrorMessage', 'showInformationMessage',
    'showWarningMessage', 'setStatusBarMessage',
    // From IOutputChannel (vscode.OutputChannel)
    'appendLine', 'appendLine'
];
const ignoredPrefix = 'src/test'.replace(/\//g, path.sep);

const failureMessage = 'Messages must be localized in the Python Extension (use src/client/common/utils/localize.ts)';

class NoStringLiteralsInMessages extends BaseRuleWalker {
    protected visitCallExpression(node: ts.CallExpression): void {
        if (!this.shouldIgnoreNode(node)) {
            node.arguments
                .filter(arg => ts.isStringLiteral(arg) || ts.isTemplateLiteral(arg))
                .forEach(arg => {
                    this.addFailureAtNode(arg, failureMessage);
                });
        }
        super.visitCallExpression(node);
    }
    protected shouldIgnoreCurrentFile(node: ts.Node) {
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
    private shouldIgnoreNode(node: ts.CallExpression) {
        if (this.shouldIgnoreCurrentFile(node)) {
            return true;
        }
        if (!ts.isPropertyAccessExpression(node.expression)) {
            return true;
        }
        const prop = node.expression as ts.PropertyAccessExpression;
        if (methodNames.indexOf(prop.name.text) < 0) {
            return true;
        }
        return false;
    }
}

export class Rule extends Lint.Rules.AbstractRule {
    public static FAILURE_STRING = failureMessage;
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new NoStringLiteralsInMessages(sourceFile, this.getOptions()));
    }
}

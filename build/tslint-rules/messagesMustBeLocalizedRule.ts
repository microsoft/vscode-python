// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import * as Lint from 'tslint';
import * as ts from 'typescript';
import * as util from '../util';
import { BaseRuleWalker } from './baseRuleWalker';

const methodNames = [
    // From IApplicationShell (vscode.window):
    'showErrorMessage', 'showInformationMessage',
    'showWarningMessage', 'setStatusBarMessage',
    // From IOutputChannel (vscode.OutputChannel):
    'appendLine', 'appendLine'
];
// tslint:ignore-next-line:no-suspicious-comments
// TODO: Ideally we would not ignore any files.
const ignoredFiles = util.getListOfFiles('unlocalizedFiles.json');
const ignoredPrefix = path.normalize('src/test');

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

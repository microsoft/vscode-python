// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as Lint from 'tslint';
import * as ts from 'typescript';

const methodNames = [
    // From IApplicationShell (vscode.window)
    'showErrorMessage', 'showInformationMessage',
    'showWarningMessage', 'setStatusBarMessage',
    // From IOutputChannel (vscode.OutputChannel)
    'appendLine', 'appendLine'
];

const failureMessage = 'Header must contain copyright and \'use strict\' in the Python Extension';

class NoStringLiteralsInMessages extends Lint.RuleWalker {
    protected visitCallExpression(node: ts.CallExpression): void {
        const prop = node.expression as ts.PropertyAccessExpression;
        if (ts.isPropertyAccessExpression(node.expression) &&
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

export class Rule extends Lint.Rules.AbstractRule {
    public static FAILURE_STRING = failureMessage;
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new NoStringLiteralsInMessages(sourceFile, this.getOptions()));
    }
}

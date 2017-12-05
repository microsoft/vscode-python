'use strict';

import * as baseLinter from './baseLinter';
import { OutputChannel } from 'vscode';
import { Product, ProductExecutableAndArgs } from '../common/installer';
import { TextDocument, CancellationToken } from 'vscode';

const REGEX = '(?<file>.py):(?<line>\\d+):(?<column>\\d+): \\[(?<type>\\w+)\\] (?<code>\\w\\d+):? (?<message>.*)\\r?(\\n|$)';

export class Linter extends baseLinter.BaseLinter {
    _columnOffset = 1;

    constructor(outputChannel: OutputChannel) {
        super('pylama', Product.pylama, outputChannel);
    }

    protected runLinter(document: TextDocument, cancellation: CancellationToken): Promise<baseLinter.ILintMessage[]> {
        if (!this.pythonSettings.linting.pylamaEnabled) {
            return Promise.resolve([]);
        }

        let pylamaPath = this.pythonSettings.linting.pylamaPath;
        let pylamaArgs = Array.isArray(this.pythonSettings.linting.pylamaArgs) ? this.pythonSettings.linting.pylamaArgs : [];

        if (pylamaArgs.length === 0 && ProductExecutableAndArgs.has(Product.pylama) && pylamaPath.toLocaleLowerCase() === 'pylama') {
            pylamaPath = ProductExecutableAndArgs.get(Product.pylama).executable;
            pylamaArgs = ProductExecutableAndArgs.get(Product.pylama).args;
        }

        return this.run(pylamaPath, pylamaArgs.concat(['--format=parsable', document.uri.fsPath]), document, this.getWorkspaceRootPath(document), cancellation, REGEX).then(messages => {
            // All messages in pylama are treated as warnings for now.
            messages.forEach(msg => {
                msg.severity = baseLinter.LintMessageSeverity.Warning;
            });

            return messages;
        });
    }
}

'use strict';

import * as baseLinter from './baseLinter';
import { OutputChannel } from 'vscode';
import { Product, ProductExecutableAndArgs } from '../common/installer';
import { TextDocument, CancellationToken } from 'vscode';

export class Linter extends baseLinter.BaseLinter {
    _columnOffset = 1;

    constructor(outputChannel: OutputChannel) {
        super('pep8', Product.pep8, outputChannel);
    }

    protected runLinter(document: TextDocument, cancellation: CancellationToken): Promise<baseLinter.ILintMessage[]> {
        if (!this.pythonSettings.linting.pep8Enabled) {
            return Promise.resolve([]);
        }

        let pep8Path = this.pythonSettings.linting.pep8Path;
        let pep8Args = Array.isArray(this.pythonSettings.linting.pep8Args) ? this.pythonSettings.linting.pep8Args : [];

        if (pep8Args.length === 0 && ProductExecutableAndArgs.has(Product.pep8) && pep8Path.toLocaleLowerCase() === 'pep8') {
            pep8Path = ProductExecutableAndArgs.get(Product.pep8).executable;
            pep8Args = ProductExecutableAndArgs.get(Product.pep8).args;
        }

        return this.run(pep8Path, pep8Args.concat(['--format=%(row)d,%(col)d,%(code).1s,%(code)s:%(text)s', document.uri.fsPath]), document, this.getWorkspaceRootPath(document), cancellation).then(messages => {
            messages.forEach(msg => {
                msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.pep8CategorySeverity);
            });

            return messages;
        });
    }
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, OutputChannel, TextDocument } from 'vscode';
import '../common/extensions';
import { Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { BaseLinter } from './baseLinter';
import { ILintMessage, LintMessageSeverity } from './types';

export class Bandit extends BaseLinter {
    constructor(outputChannel: OutputChannel, serviceContainer: IServiceContainer) {
        super(Product.bandit, outputChannel, serviceContainer);

    }

    protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
        const messages = await this.run(['-f', 'custom', '--msg-template', '{line},0,{severity},{test_id}:{msg}', document.uri.fsPath], document, cancellation);

        messages.forEach(msg => {
            msg.severity = {
                LOW: LintMessageSeverity.Information,
                MEDIUM: LintMessageSeverity.Warning,
                HIGH: LintMessageSeverity.Error
            }[msg.type];
        });
        return messages;
    }
}

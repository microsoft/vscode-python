// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, OutputChannel, TextDocument } from 'vscode';
import '../common/extensions';
import { Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { BaseLinter } from './baseLinter';
import { ILintMessage } from './types';

const REGEX = '(?<file>.py):(?<line>\\d+): (?<code>B\\S+): (?<type>\\w+): (?<message>.*)\\r?(\\n|$)';

export class Bandit extends BaseLinter {
    constructor(outputChannel: OutputChannel, serviceContainer: IServiceContainer) {
        super(Product.bandit, outputChannel, serviceContainer);
    }

    protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
        const messages = await this.run(['-f', 'custom', document.uri.fsPath], document, cancellation, REGEX);
        messages.forEach(msg => {
            msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.banditCategorySeverity);
            msg.code = msg.type;
        });
        return messages;
    }
}

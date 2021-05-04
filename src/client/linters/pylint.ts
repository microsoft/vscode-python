// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, OutputChannel, TextDocument } from 'vscode';
import '../common/extensions';
import { Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { BaseLinter } from './baseLinter';
import { ILintMessage } from './types';

const REGEX = '(?<line>\\d+),(?<column>-?\\d+),(?<type>\\w+),(?<code>[\\w-]+):(?<message>.*)\\r?(\\n|$)';

export class Pylint extends BaseLinter {
    constructor(outputChannel: OutputChannel, serviceContainer: IServiceContainer) {
        super(Product.pylint, outputChannel, serviceContainer);
    }

    protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
        const uri = document.uri;
        const settings = this.configService.getSettings(uri);
        const args = [
            "--msg-template='{line},{column},{category},{symbol}:{msg}'",
            '--reports=n',
            '--output-format=text',
            uri.fsPath,
        ];
        const messages = await this.run(args, document, cancellation, REGEX);
        messages.forEach((msg) => {
            msg.severity = this.parseMessagesSeverity(msg.type, settings.linting.pylintCategorySeverity);
        });

        return messages;
    }
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, OutputChannel, TextDocument } from 'vscode';
import '../common/extensions';
import { Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { BaseLinter } from './baseLinter';
import { ILintMessage } from './types';

const REGEX_POSITION = '(?<line>\\d+),(?<column>-?\\d+),(?<type>\\w+),(?<code>[\\w-]+):(?<message>.*)\\r?(\\n|$)';
const REGEX_RANGE =
    '(?<line>\\d+),(?<column>-?\\d+),(?<endLine>\\d+)?,(?<endColumn>-?\\d+)?,(?<type>\\w+),(?<code>[\\w-]+):(?<message>.*)\\r?(\\n|$)';

const TEMPLATE_POSITION = "--msg-template='{line},{column},{category},{symbol}:{msg}'";
const TEMPLATE_RANGE = "--msg-template='{line},{column},{end_line},{end_column},{category},{symbol}:{msg}'";

export class Pylint extends BaseLinter {
    constructor(outputChannel: OutputChannel, serviceContainer: IServiceContainer) {
        super(Product.pylint, outputChannel, serviceContainer);
    }

    protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
        const uri = document.uri;
        const settings = this.configService.getSettings(uri);
        const args = [
            settings.linting.pylintErrorRangeEnabled ? TEMPLATE_RANGE : TEMPLATE_POSITION,
            '--reports=n',
            '--output-format=text',
            uri.fsPath,
        ];
        const messages = await this.run(
            args,
            document,
            cancellation,
            settings.linting.pylintErrorRangeEnabled ? REGEX_RANGE : REGEX_POSITION,
        );
        messages.forEach((msg) => {
            msg.severity = this.parseMessagesSeverity(msg.type, settings.linting.pylintCategorySeverity);
        });

        return messages;
    }
}

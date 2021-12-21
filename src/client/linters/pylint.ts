// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CancellationToken, TextDocument } from 'vscode';
import '../common/extensions';
import { Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { traceError } from '../logging';
import { BaseLinter } from './baseLinter';
import { ILintMessage } from './types';

interface IJsonMessage {
    column: number | null;
    line: number;
    message: string;
    symbol: string;
    type: string;
    endLine?: number | null;
    endColumn?: number | null;
}

export class Pylint extends BaseLinter {
    constructor(serviceContainer: IServiceContainer) {
        super(Product.pylint, serviceContainer);
    }

    protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
        const { uri } = document;
        const settings = this.configService.getSettings(uri);
        const args = ['--reports=n', '--output-format=json', uri.fsPath];
        const messages = await this.run(args, document, cancellation);
        messages.forEach((msg) => {
            msg.severity = this.parseMessagesSeverity(msg.type, settings.linting.pylintCategorySeverity);
        });

        return messages;
    }

    private parseOutputMessage(outputMsg: IJsonMessage, colOffset = 0): ILintMessage | undefined {
        // Both 'endLine' and 'endColumn' are only present on pylint 2.12.2+
        // If present, both can still be 'null' if AST node didn't have endLine and / or endColumn information.
        // If 'endColumn' is 'null' or not preset, set it to 'undefined' to
        // prevent the lintingEngine from inferring an error range.
        if (outputMsg.endColumn) {
            outputMsg.endColumn = outputMsg.endColumn <= 0 ? 0 : outputMsg.endColumn - colOffset;
        } else {
            outputMsg.endColumn = undefined;
        }

        return {
            code: outputMsg.symbol,
            message: outputMsg.message,
            column: outputMsg.column === null || outputMsg.column <= 0 ? 0 : outputMsg.column - colOffset,
            line: outputMsg.line,
            type: outputMsg.type,
            provider: this.info.id,
            endLine: outputMsg.endLine === null ? undefined : outputMsg.endLine,
            endColumn: outputMsg.endColumn,
        };
    }

    protected async parseMessages(
        output: string,
        _document: TextDocument,
        _token: CancellationToken,
        _: string,
    ): Promise<ILintMessage[]> {
        const messages: ILintMessage[] = [];
        try {
            const parsedOutput: IJsonMessage[] = JSON.parse(output);
            for (const outputMsg of parsedOutput) {
                const msg = this.parseOutputMessage(outputMsg, this.columnOffset);
                if (msg) {
                    messages.push(msg);
                    if (messages.length >= this.pythonSettings.linting.maxNumberOfProblems) {
                        break;
                    }
                }
            }
        } catch (ex) {
            traceError(`Linter '${this.info.id}' failed to parse the output '${output}.`, ex);
        }
        return messages;
    }
}

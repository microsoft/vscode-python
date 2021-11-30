// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { CancellationToken, OutputChannel, TextDocument } from 'vscode';
import '../common/extensions';
import { Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { traceError } from '../logging';
import { BaseLinter } from './baseLinter';
import { ILintMessage, LinterId } from './types';

interface IJsonMessage {
    column: number | null;
    line: number;
    message: string;
    symbol: string;
    type: string;
    endLine: number | null | undefined;
    endColumn: number | null | undefined;
}

export class Pylint extends BaseLinter {
    constructor(outputChannel: OutputChannel, serviceContainer: IServiceContainer) {
        super(Product.pylint, outputChannel, serviceContainer);
    }

    protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
        const uri = document.uri;
        const settings = this.configService.getSettings(uri);
        const args = ['--reports=n', '--output-format=json', uri.fsPath];
        const messages = await this.run(args, document, cancellation);
        messages.forEach((msg) => {
            msg.severity = this.parseMessagesSeverity(msg.type, settings.linting.pylintCategorySeverity);
        });

        return messages;
    }

    private parseOutputMessage(
        outputMsg: IJsonMessage,
        linterID: LinterId,
        colOffset: number = 0,
    ): ILintMessage | undefined {
        if (outputMsg.endColumn === null) {
            outputMsg.endColumn = 0;
        } else if (outputMsg.endColumn !== undefined) {
            outputMsg.endColumn = outputMsg.endColumn <= 0 ? 0 : outputMsg.endColumn - colOffset;
        }

        return {
            code: outputMsg.symbol,
            message: outputMsg.message,
            column: outputMsg.column === null || outputMsg.column <= 0 ? 0 : outputMsg.column - colOffset,
            line: outputMsg.line,
            type: outputMsg.type,
            provider: linterID,
            endLine: outputMsg.endLine === null ? undefined : outputMsg.endLine,
            endColumn: outputMsg.endColumn,
        };
    }

    protected async parseMessages(
        output: string,
        _document: vscode.TextDocument,
        _tolen: vscode.CancellationToken,
        _: string,
    ) {
        const messages: ILintMessage[] = [];
        try {
            const parsedOutput: IJsonMessage[] = JSON.parse(output);
            for (const outputMsg of parsedOutput) {
                const msg = this.parseOutputMessage(outputMsg, this.info.id, this.columnOffset);
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

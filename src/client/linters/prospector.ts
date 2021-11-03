import * as path from 'path';
import { CancellationToken, OutputChannel, TextDocument } from 'vscode';
import '../common/extensions';
import { Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { traceError } from '../logging';
import { BaseLinter } from './baseLinter';
import { ILintMessage } from './types';

interface IProspectorResponse {
    messages: IProspectorMessage[];
}
interface IProspectorMessage {
    source: string;
    message: string;
    code: string;
    location: IProspectorLocation;
}
interface IProspectorLocation {
    function: string;
    path: string;
    line: number;
    character: number;
    module: 'beforeFormat';
}

export class Prospector extends BaseLinter {
    constructor(outputChannel: OutputChannel, serviceContainer: IServiceContainer) {
        super(Product.prospector, outputChannel, serviceContainer);
    }

    protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
        const cwd = this.getWorkingDirectoryPath(document);
        const relativePath = path.relative(cwd, document.uri.fsPath);
        return this.run(['--absolute-paths', '--output-format=json', relativePath], document, cancellation);
    }
    protected async parseMessages(output: string, _document: TextDocument, _token: CancellationToken, _regEx: string) {
        let parsedData: IProspectorResponse;
        try {
            parsedData = JSON.parse(output);
        } catch (ex) {
            this.outputChannel.appendLine(`${'#'.repeat(10)}Linting Output - ${this.info.id}${'#'.repeat(10)}`);
            this.outputChannel.append(output);
            traceError('Failed to parse Prospector output', ex);
            return [];
        }
        return parsedData.messages
            .filter((_value, index) => index <= this.pythonSettings.linting.maxNumberOfProblems)
            .map((msg) => {
                const lineNumber = msg.location.line === null || isNaN(msg.location.line) ? 1 : msg.location.line;

                return {
                    code: msg.code,
                    message: msg.message,
                    column: msg.location.character,
                    line: lineNumber,
                    type: msg.code,
                    provider: `${this.info.id} - ${msg.source}`,
                };
            });
    }
}

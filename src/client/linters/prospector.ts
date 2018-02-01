import { OutputChannel } from 'vscode';
import { CancellationToken, TextDocument } from 'vscode';
import { Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
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
        return await this.run(['--absolute-paths', '--output-format=json', document.uri.fsPath], document, cancellation);
    }
    protected async parseMessages(output: string, document: TextDocument, token: CancellationToken, regEx: string) {
        let parsedData: IProspectorResponse;
        try {
            parsedData = JSON.parse(output);
        } catch (ex) {
            this.outputChannel.appendLine(`${'#'.repeat(10)}Linting Output - ${this.info.id}${'#'.repeat(10)}`);
            this.outputChannel.append(output);
            this.logger.logError('Failed to parse Prospector output', ex);
            return [];
        }
        return parsedData.messages
            .filter((value, index) => index <= this.pythonSettings.linting.maxNumberOfProblems)
            .map(msg => {

                const lineNumber = msg.location.line === null || isNaN(msg.location.line) ? 1 : msg.location.line;

                return {
                    code: msg.code,
                    message: msg.message,
                    column: msg.location.character,
                    line: lineNumber,
                    type: msg.code,
                    provider: `${this.info.id} - ${msg.source}`
                };
            });
    }
}

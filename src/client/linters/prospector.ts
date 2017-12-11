import { OutputChannel } from 'vscode';
import { CancellationToken, TextDocument } from 'vscode';
import { IInstaller, ILogger, Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import * as baseLinter from './baseLinter';
import { ILinterHelper } from './types';

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

export class Linter extends baseLinter.BaseLinter {
    constructor(outputChannel: OutputChannel, installer: IInstaller, helper: ILinterHelper, logger: ILogger, serviceContainer: IServiceContainer) {
        super(Product.prospector, outputChannel, installer, helper, logger, serviceContainer);
    }

    protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<baseLinter.ILintMessage[]> {
        return await this.run(['--absolute-paths', '--output-format=json', document.uri.fsPath], document, cancellation);
    }
    protected async parseMessages(output: string, document: TextDocument, token: CancellationToken, regEx: string) {
        let parsedData: IProspectorResponse;
        try {
            parsedData = JSON.parse(output);
        } catch (ex) {
            this.outputChannel.appendLine(`${'#'.repeat(10)}Linting Output - ${this.Id}${'#'.repeat(10)}`);
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
                    provider: `${this.Id} - ${msg.source}`
                };
            });
    }
}

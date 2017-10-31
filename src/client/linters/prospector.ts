'use strict';

import * as baseLinter from './baseLinter';
import { OutputChannel } from 'vscode';
import { execPythonFile } from './../common/utils';
import { Product, ProductExecutableAndArgs } from '../common/installer';
import { TextDocument, CancellationToken } from 'vscode';

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
    module: "beforeFormat";
}

export class Linter extends baseLinter.BaseLinter {
    constructor(outputChannel: OutputChannel) {
        super('prospector', Product.prospector, outputChannel);
    }

    protected runLinter(document: TextDocument, cancellation: CancellationToken): Promise<baseLinter.ILintMessage[]> {
        if (!this.pythonSettings.linting.prospectorEnabled) {
            return Promise.resolve([]);
        }

        let prospectorPath = this.pythonSettings.linting.prospectorPath;
        let outputChannel = this.outputChannel;
        let prospectorArgs = Array.isArray(this.pythonSettings.linting.prospectorArgs) ? this.pythonSettings.linting.prospectorArgs : [];

        if (prospectorArgs.length === 0 && ProductExecutableAndArgs.has(Product.prospector) && prospectorPath.toLocaleLowerCase() === 'prospector') {
            prospectorPath = ProductExecutableAndArgs.get(Product.prospector).executable;
            prospectorArgs = ProductExecutableAndArgs.get(Product.prospector).args;
        }

        return new Promise<baseLinter.ILintMessage[]>((resolve, reject) => {
            execPythonFile(document.uri, prospectorPath, prospectorArgs.concat(['--absolute-paths', '--output-format=json', document.uri.fsPath]), this.getWorkspaceRootPath(document), false, null, cancellation).then(data => {
                let parsedData: IProspectorResponse;
                try {
                    parsedData = JSON.parse(data);
                }
                catch (ex) {
                    outputChannel.append('#'.repeat(10) + 'Linting Output - ' + this.Id + '#'.repeat(10) + '\n');
                    outputChannel.append(data);
                    return resolve([]);
                }
                let diagnostics: baseLinter.ILintMessage[] = [];
                parsedData.messages.filter((value, index) => index <= this.pythonSettings.linting.maxNumberOfProblems).forEach(msg => {

                    let lineNumber = msg.location.line === null || isNaN(msg.location.line) ? 1 : msg.location.line;

                    diagnostics.push({
                        code: msg.code,
                        message: msg.message,
                        column: msg.location.character,
                        line: lineNumber,
                        type: msg.code,
                        provider: `${this.Id} - ${msg.source}`
                    });
                });

                resolve(diagnostics);
            }).catch(error => {
                this.handleError(this.Id, prospectorPath, error, document.uri);
                resolve([]);
            });
        });
    }
}

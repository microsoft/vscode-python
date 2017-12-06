import * as path from 'path';
import { OutputChannel } from 'vscode';
import { CancellationToken, TextDocument } from 'vscode';
import { IInstaller, ILogger, Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { IS_WINDOWS } from './../common/utils';
import * as baseLinter from './baseLinter';
import { ILintMessage } from './baseLinter';
import { ILinterHelper } from './types';

export class Linter extends baseLinter.BaseLinter {
    constructor(outputChannel: OutputChannel, installer: IInstaller, helper: ILinterHelper, logger: ILogger, serviceContainer: IServiceContainer) {
        super(Product.pydocstyle, outputChannel, installer, helper, logger, serviceContainer);
    }

    protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<baseLinter.ILintMessage[]> {
        const messages = await this.run([document.uri.fsPath], document, cancellation);
        // All messages in pep8 are treated as warnings for now.
        messages.forEach(msg => {
            msg.severity = baseLinter.LintMessageSeverity.Warning;
        });

        return messages;
    }

    protected async parseMessages(output: string, document: TextDocument, token: CancellationToken, regEx: string) {
        let outputLines = output.split(/\r?\n/g);
        const baseFileName = path.basename(document.uri.fsPath);

        // Remember, the first line of the response contains the file name and line number, the next line contains the error message.
        // So we have two lines per message, hence we need to take lines in pairs.
        const maxLines = this.pythonSettings.linting.maxNumberOfProblems * 2;
        // First line is almost always empty.
        const oldOutputLines = outputLines.filter(line => line.length > 0);
        outputLines = [];
        for (let counter = 0; counter < oldOutputLines.length / 2; counter += 1) {
            outputLines.push(oldOutputLines[2 * counter] + oldOutputLines[(2 * counter) + 1]);
        }

        return outputLines
            .filter((value, index) => index < maxLines && value.indexOf(':') >= 0)
            .map(line => {
                // Windows will have a : after the drive letter (e.g. c:\).
                if (IS_WINDOWS) {
                    return line.substring(line.indexOf(`${baseFileName}:`) + baseFileName.length + 1).trim();
                }
                return line.substring(line.indexOf(':') + 1).trim();
            })
            // Iterate through the lines (skipping the messages).
            // So, just iterate the response in pairs.
            .map(line => {
                try {
                    if (line.trim().length === 0) {
                        return;
                    }
                    const lineNumber = parseInt(line.substring(0, line.indexOf(' ')), 10);
                    const part = line.substring(line.indexOf(':') + 1).trim();
                    const code = part.substring(0, part.indexOf(':')).trim();
                    const message = part.substring(part.indexOf(':') + 1).trim();

                    const sourceLine = document.lineAt(lineNumber - 1).text;
                    const trmmedSourceLine = sourceLine.trim();
                    const sourceStart = sourceLine.indexOf(trmmedSourceLine);

                    return {
                        code: code,
                        message: message,
                        column: sourceStart,
                        line: lineNumber,
                        type: '',
                        provider: this.Id
                    } as ILintMessage;
                } catch (ex) {
                    this.logger.logError(`Failed to parse pydocstyle line '${line}'`, ex);
                    return;
                }
            })
            .filter(item => item !== undefined)
            .map(item => item!);
    }
}

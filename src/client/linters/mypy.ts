import { OutputChannel } from 'vscode';
import { CancellationToken, TextDocument } from 'vscode';
import { IInstaller, ILogger, Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import * as baseLinter from './baseLinter';
import { ILinterHelper } from './types';

const REGEX = '(?<file>.py):(?<line>\\d+): (?<type>\\w+): (?<message>.*)\\r?(\\n|$)';

export class Linter extends baseLinter.BaseLinter {
    constructor(outputChannel: OutputChannel, installer: IInstaller, helper: ILinterHelper, logger: ILogger, serviceContainer: IServiceContainer) {
        super(Product.mypy, outputChannel, installer, helper, logger, serviceContainer);
    }

    protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<baseLinter.ILintMessage[]> {
        const messages = await this.run([document.uri.fsPath], document, cancellation, REGEX);
        messages.forEach(msg => {
            msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.mypyCategorySeverity);
            msg.code = msg.type;
        });
        return messages;
    }
}

import { OutputChannel } from 'vscode';
import { CancellationToken, TextDocument } from 'vscode';
import { IInstaller, ILogger, Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import * as baseLinter from './baseLinter';
import { ILinterHelper } from './types';

export class Linter extends baseLinter.BaseLinter {
    constructor(outputChannel: OutputChannel, installer: IInstaller, helper: ILinterHelper, logger: ILogger, serviceContainer: IServiceContainer) {
        super(Product.pylint, outputChannel, installer, helper, logger, serviceContainer);
    }

    protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<baseLinter.ILintMessage[]> {
        const msgTemplate = `'{line},{column},{category},${this.pythonSettings.linting.pylintMsgTemplate}'`;
        const messages = await this.run([`--msg-template=${msgTemplate}`, '--reports=n', '--output-format=text', document.uri.fsPath], document, cancellation);
        messages.forEach(msg => {
            msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.pylintCategorySeverity);
        });

        return messages;
    }
}

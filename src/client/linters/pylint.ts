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
        let msgBody;
        let regex;
        if (this.pythonSettings.linting.pylintMsgTemplate === 'legacy') {
            msgBody = '{msg_id}:{msg}';
        } else if (this.pythonSettings.linting.pylintMsgTemplate === 'standard') {
            msgBody = '{msg} ({symbol})';
            regex = '(?<line>\\d+),(?<column>\\d+),(?<type>\\w+),(?<code>[a-z-]+):(?<message>.*)\\r?(\\n|$)';
        }
        let codeVar = '{symbol}';
        if (msgBody.includes('{msg_id}') && !msgBody.includes('{symbol}')) {
            codeVar = '{msg_id}';
        }
        const msgTemplate = `'{line},{column},{category},${codeVar}:${msgBody}'`;
        const messages = await this.run([`--msg-template=${msgTemplate}`, '--reports=n', '--output-format=text', document.uri.fsPath], document, cancellation, regex);
        messages.forEach(msg => {
            msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.pylintCategorySeverity);
            msg.preformattedMessage = true;
        });

        return messages;
    }
}

import { OutputChannel } from 'vscode';
import { CancellationToken, TextDocument } from 'vscode';
import { Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { BaseLinter } from './baseLinter';
import { ILintMessage } from './types';

export class Pylint extends BaseLinter {
    constructor(outputChannel: OutputChannel, serviceContainer: IServiceContainer) {
        super(Product.pylint, outputChannel, serviceContainer);
    }

    protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
        const messages = await this.run(['--msg-template=\'{line},{column},{category},{msg_id}:{msg}\'', '--reports=n', '--output-format=text', document.uri.fsPath], document, cancellation);
        messages.forEach(msg => {
            msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.pylintCategorySeverity);
        });

        return messages;
    }
}

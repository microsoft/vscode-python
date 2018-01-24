import { OutputChannel } from 'vscode';
import { CancellationToken, TextDocument } from 'vscode';
import { Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { BaseLinter } from './baseLinter';
import { ILintMessage } from './types';

const COLUMN_OFF_SET = 1;

export class Pep8 extends BaseLinter {
    constructor(outputChannel: OutputChannel, serviceContainer: IServiceContainer) {
        super(Product.pep8, outputChannel, serviceContainer, COLUMN_OFF_SET);
    }

    protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
        const messages = await this.run(['--format=%(row)d,%(col)d,%(code).1s,%(code)s:%(text)s', document.uri.fsPath], document, cancellation);
        messages.forEach(msg => {
            msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.pep8CategorySeverity);
        });
        return messages;
    }
}

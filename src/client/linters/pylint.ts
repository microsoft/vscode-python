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
        let minArgs: string[] = [];
        if (this.configService.getSettings(document.uri).linting.useMinimalCheckers) {
            minArgs = [
                '--disable=all',
                '--enable=F,E,unreachable,duplicate-key,unnecessary-semicolon,global-variable-not-assigned,unused-variable,unused-wildcard-import,binary-op-exception,bad-format-string,anomalous-backslash-in-string,bad-open-mode'
            ];
        }
        const args = [
            '--msg-template=\'{line},{column},{category},{msg_id}:{msg}\'',
            '--reports=n',
            '--output-format=text',
            document.uri.fsPath
        ];
        const messages = await this.run(minArgs.concat(args), document, cancellation);
        messages.forEach(msg => {
            msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.pylintCategorySeverity);
        });

        return messages;
    }
}

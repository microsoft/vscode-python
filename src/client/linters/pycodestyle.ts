import { CancellationToken, TextDocument } from 'vscode';
import '../common/extensions';
import { Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { BaseLinter } from './baseLinter';
import { ILintMessage } from './types';

const COLUMN_OFF_SET = 1;

export class Pycodestyle extends BaseLinter {
    constructor(serviceContainer: IServiceContainer) {
        super(Product.pycodestyle, serviceContainer, COLUMN_OFF_SET);
    }

    protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
        const messages = await this.run(
            ['--format= %(row)d,%(col)d,%(code).1s,%(code)s:%(text)s', document.uri.fsPath],
            document,
            cancellation,
        );
        messages.forEach((msg) => {
            msg.severity = this.parseMessagesSeverity(
                msg.type,
                this.pythonSettings.linting.pycodestyleCategorySeverity,
            );
        });
        return messages;
    }
}

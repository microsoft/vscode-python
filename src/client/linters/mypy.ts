import { CancellationToken, OutputChannel, TextDocument } from 'vscode';
import '../common/extensions';
import { escapeRegExp } from 'lodash';
import { Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { BaseLinter } from './baseLinter';
import { ILintMessage } from './types';

export function getRegex(filepath: string): string {
    return `${escapeRegExp(filepath)}:(?<line>\\d+)(:(?<column>\\d+))?: (?<type>\\w+): (?<message>.*)\\r?(\\n|$)`;
}

export class MyPy extends BaseLinter {
    constructor(outputChannel: OutputChannel, serviceContainer: IServiceContainer) {
        super(Product.mypy, outputChannel, serviceContainer);
    }

    protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
        const fileName = document.uri.fsPath.slice(this.getWorkspaceRootPath(document).length + 1);
        const regex = getRegex(fileName);
        const messages = await this.run([document.uri.fsPath], document, cancellation, regex);
        messages.forEach((msg) => {
            msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.mypyCategorySeverity);
            msg.code = msg.type;
        });
        return messages;
    }
}

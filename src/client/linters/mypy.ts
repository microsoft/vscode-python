import { CancellationToken, OutputChannel, TextDocument } from 'vscode';
import '../common/extensions';
import * as path from 'path';
import { Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { BaseLinter } from './baseLinter';
import { ILintMessage } from './types';

export const REGEX = '(?<file>[^:]+):(?<line>\\d+)(:(?<column>\\d+))?: (?<type>\\w+): (?<message>.*)\\r?(\\n|$)';

export class MyPy extends BaseLinter {
    constructor(outputChannel: OutputChannel, serviceContainer: IServiceContainer) {
        super(Product.mypy, outputChannel, serviceContainer);
    }

    protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
        const messages = await this.run([document.uri.fsPath], document, cancellation, REGEX);
        const filteredMessages: ILintMessage[] = [];
        messages.forEach((msg) => {
            if (msg.file == null) {
                return;
            }
            const messageFilePath = path.join(this.getWorkspaceRootPath(document), msg.file);
            if (messageFilePath !== document.uri.fsPath) {
                return;
            }
            msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.mypyCategorySeverity);
            msg.code = msg.type;
            filteredMessages.push(msg);
        });
        return filteredMessages;
    }
}

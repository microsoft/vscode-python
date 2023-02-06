import { CancellationToken, TextDocument } from 'vscode';
import '../common/extensions';
import { Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { traceLog } from '../logging';
import { BaseLinter } from './baseLinter';
import { isExtensionEnabled } from './prompts/common';
import { FLAKE8_EXTENSION } from './prompts/flake8Prompt';
import { IToolsExtensionPrompt } from './prompts/types';
import { ILintMessage } from './types';

const COLUMN_OFF_SET = 1;

export class Flake8 extends BaseLinter {
    constructor(serviceContainer: IServiceContainer, private readonly prompt: IToolsExtensionPrompt) {
        super(Product.flake8, serviceContainer, COLUMN_OFF_SET);
    }

    protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
        await this.prompt.showPrompt();

        if (isExtensionEnabled(this.serviceContainer, FLAKE8_EXTENSION)) {
            traceLog(
                'LINTING: Skipping linting from Python extension, since Flake8 extension is installed and enabled.',
            );
            return [];
        }

        const messages = await this.run([document.uri.fsPath], document, cancellation);
        messages.forEach((msg) => {
            msg.severity = this.parseMessagesSeverity(msg.type, this.pythonSettings.linting.flake8CategorySeverity);
            // flake8 uses 0th line for some file-wide problems
            // but diagnostics expects positive line numbers.
            if (msg.line === 0) {
                msg.line = 1;
            }
        });
        return messages;
    }
}

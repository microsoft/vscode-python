import { CancellationToken, TextDocument } from 'vscode';
import '../common/extensions';
import { Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { traceLog } from '../logging';
import { BaseLinter } from './baseLinter';
import { Flake8ExtensionPrompt } from './prompts/flake8Prompt';
import { IToolsExtensionPrompt } from './prompts/types';
import { ILintMessage } from './types';

const COLUMN_OFF_SET = 1;

export class Flake8 extends BaseLinter {
    private readonly prompt: IToolsExtensionPrompt;

    constructor(serviceContainer: IServiceContainer) {
        super(Product.flake8, serviceContainer, COLUMN_OFF_SET);
        this.prompt = new Flake8ExtensionPrompt(serviceContainer);
    }

    protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
        if (await this.prompt.showPrompt()) {
            traceLog('LINTING: Skipping linting from Python extension, since Flake8 extension is installed.');
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

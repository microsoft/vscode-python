import { CancellationToken, TextDocument } from 'vscode';
import '../common/extensions';
import { Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { BaseLinter } from './baseLinter';
import { ILintMessage, LintMessageSeverity } from './types';

/**
 * Example messages to parse from PyLama
 * 1. Linter: pycodestyle - recent version removed an extra colon (:) after line:col, hence made it optional in the regex (to be backward compatibile)
 *      `src/test_py.py:23:60 [E] E226 missing whitespace around arithmetic operator [pycodestyle]`
 * 2. Linter: mypy - output is missing the error code, something like `E226` - hence made it optional in the regex
 *      `src/test_py.py:7:4 [E]  Argument 1 to "fn" has incompatible type "str"; expected "int" [mypy]`
 */

const REGEX =
    '(?<file>.py):(?<line>\\d+):(?<column>\\d+):? \\[(?<type>\\w+)\\]( (?<code>\\w\\d+)?:?)? (?<message>.*)\\r?(\\n|$)';
const COLUMN_OFF_SET = 1;

export class PyLama extends BaseLinter {
    constructor(serviceContainer: IServiceContainer) {
        super(Product.pylama, serviceContainer, COLUMN_OFF_SET);
    }

    protected async runLinter(document: TextDocument, cancellation: CancellationToken): Promise<ILintMessage[]> {
        const messages = await this.run([document.uri.fsPath], document, cancellation, REGEX);
        // All messages in pylama are treated as warnings for now.
        messages.forEach((msg) => {
            msg.severity = LintMessageSeverity.Warning;
        });

        return messages;
    }
}

import {
    CancellationToken,
    FormattingOptions,
    OnTypeFormattingEditProvider,
    Position,
    TextDocument,
    TextEdit,
} from 'vscode';
import { CodeBlockFormatProvider } from './codeBlockFormatProvider';
import {
    ASYNC_DEF_REGEX,
    ASYNC_FOR_IN_REGEX,
    CLASS_REGEX,
    DEF_REGEX,
    ELIF_REGEX,
    ELSE_REGEX,
    EXCEPT_REGEX,
    FINALLY_REGEX,
    FOR_IN_REGEX,
    IF_REGEX,
    TRY_REGEX,
    WHILE_REGEX,
} from './contracts';

export class BlockFormatProviders implements OnTypeFormattingEditProvider {
    private providers: CodeBlockFormatProvider[];
    constructor() {
        this.providers = [];
        const boundaryBlocks = [DEF_REGEX, ASYNC_DEF_REGEX, CLASS_REGEX];

        const elseParentBlocks = [
            IF_REGEX,
            ELIF_REGEX,
            FOR_IN_REGEX,
            ASYNC_FOR_IN_REGEX,
            WHILE_REGEX,
            TRY_REGEX,
            EXCEPT_REGEX,
        ];
        this.providers.push(new CodeBlockFormatProvider(ELSE_REGEX, elseParentBlocks, boundaryBlocks));

        const elifParentBlocks = [IF_REGEX, ELIF_REGEX];
        this.providers.push(new CodeBlockFormatProvider(ELIF_REGEX, elifParentBlocks, boundaryBlocks));

        const exceptParentBlocks = [TRY_REGEX, EXCEPT_REGEX];
        this.providers.push(new CodeBlockFormatProvider(EXCEPT_REGEX, exceptParentBlocks, boundaryBlocks));

        const finallyParentBlocks = [TRY_REGEX, EXCEPT_REGEX];
        this.providers.push(new CodeBlockFormatProvider(FINALLY_REGEX, finallyParentBlocks, boundaryBlocks));
    }

    public provideOnTypeFormattingEdits(
        document: TextDocument,
        position: Position,
        ch: string,
        options: FormattingOptions,
        _token: CancellationToken
    ): TextEdit[] {
        if (position.line === 0) {
            return [];
        }

        const currentLine = document.lineAt(position.line);
        const prevousLine = document.lineAt(position.line - 1);

        // We're only interested in cases where the current block is at the same indentation level as the previous line
        // E.g. if we have an if..else block, generally the else statement would be at the same level as the code in the if...
        if (currentLine.firstNonWhitespaceCharacterIndex !== prevousLine.firstNonWhitespaceCharacterIndex) {
            return [];
        }

        const currentLineText = currentLine.text;
        const provider = this.providers.find((p) => p.canProvideEdits(currentLineText));
        if (provider) {
            return provider.provideEdits(document, position, ch, options, currentLine);
        }

        return [];
    }
}

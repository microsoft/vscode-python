import { FormattingOptions, Position, Range, TextDocument, TextEdit, TextLine } from 'vscode';
import { BlockRegEx } from './contracts';

export class CodeBlockFormatProvider {
    constructor(
        private blockRegExp: BlockRegEx,
        private previousBlockRegExps: BlockRegEx[],
        private boundaryRegExps: BlockRegEx[]
    ) {}
    public canProvideEdits(line: string): boolean {
        return this.blockRegExp.test(line);
    }

    public provideEdits(
        document: TextDocument,
        position: Position,
        _ch: string,
        options: FormattingOptions,
        line: TextLine
    ): TextEdit[] {
        // We can have else for the following blocks:
        // if:
        // elif x:
        // for x in y:
        // while x:

        // We need to find a block statement that is less than or equal to this statement block (but not greater)
        for (let lineNumber = position.line - 1; lineNumber >= 0; lineNumber -= 1) {
            const prevLine = document.lineAt(lineNumber);
            const prevLineText = prevLine.text;

            // Oops, we've reached a boundary (like the function or class definition)
            // Get out of here
            if (this.boundaryRegExps.some((value) => value.test(prevLineText))) {
                return [];
            }

            const blockRegEx = this.previousBlockRegExps.find((value) => value.test(prevLineText));
            if (!blockRegEx) {
                continue;
            }

            const startOfBlockInLine = prevLine.firstNonWhitespaceCharacterIndex;
            if (startOfBlockInLine > line.firstNonWhitespaceCharacterIndex) {
                continue;
            }

            const startPosition = new Position(position.line, 0);
            const endPosition = new Position(position.line, line.firstNonWhitespaceCharacterIndex - startOfBlockInLine);

            if (startPosition.isEqual(endPosition)) {
                // current block cannot be at the same level as a preivous block
                continue;
            }

            if (options.insertSpaces) {
                return [TextEdit.delete(new Range(startPosition, endPosition))];
            } else {
                // Delete everything before the block and insert the same characters we have in the previous block
                const prefixOfPreviousBlock = prevLineText.substring(0, startOfBlockInLine);

                const startDeletePosition = new Position(position.line, 0);
                const endDeletePosition = new Position(position.line, line.firstNonWhitespaceCharacterIndex);

                return [
                    TextEdit.delete(new Range(startDeletePosition, endDeletePosition)),
                    TextEdit.insert(startDeletePosition, prefixOfPreviousBlock),
                ];
            }
        }

        return [];
    }
}

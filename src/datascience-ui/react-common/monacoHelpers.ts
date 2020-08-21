import type * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import {
    IEditorContentChange,
    IEditorPosition,
    IEditorRange
} from '../../client/datascience/interactive-common/interactiveWindowTypes';

export interface IMonacoTextModel {
    readonly id: string;
    getValue(): string;
    getValueLength(): number;
    getVersionId(): number;
    getPositionAt(offset: number): IEditorPosition;
}

export interface IMonacoModelContentChangeEvent {
    // Changes to apply
    readonly forward: IEditorContentChange[];
    // Change to undo the apply
    readonly reverse: IEditorContentChange[];
    readonly eol: string;
    readonly versionId: number;
    readonly isUndoing: boolean;
    readonly isRedoing: boolean;
    readonly isFlush: boolean;
    readonly model: IMonacoTextModel;
}

function getValueInRange(text: string, r: IEditorRange): string {
    // Compute start and end offset using line and column data
    let startOffset = -1;
    let endOffset = -1;
    let line = 1;
    let col = 1;

    // Go forwards through the text searching for matching lines
    for (let pos = 0; pos <= text.length && (startOffset < 0 || endOffset < 0); pos += 1) {
        if (line === r.startLineNumber && col === r.startColumn) {
            startOffset = pos;
        } else if (line === r.endLineNumber && col === r.endColumn) {
            endOffset = pos;
        }
        if (pos < text.length) {
            if (text[pos] === '\n') {
                line += 1;
                col = 1;
            } else {
                col += 1;
            }
        }
    }

    if (startOffset >= 0 && endOffset >= 0) {
        return text.slice(startOffset, endOffset);
    }

    return '';
}

export function generateReverseChange(
    oldModelValue: string,
    model: IMonacoTextModel,
    c: monacoEditor.editor.IModelContentChange
): monacoEditor.editor.IModelContentChange {
    const oldStart = model.getPositionAt(c.rangeOffset);
    const oldEnd = model.getPositionAt(c.rangeOffset + c.rangeLength);
    const oldText = getValueInRange(oldModelValue, c.range);
    const oldRange: monacoEditor.IRange = {
        startColumn: oldStart.column,
        startLineNumber: oldStart.lineNumber,
        endColumn: oldEnd.column,
        endLineNumber: oldEnd.lineNumber
    };
    return {
        rangeLength: c.text.length,
        rangeOffset: c.rangeOffset,
        text: oldText ? oldText : '',
        range: oldRange
    };
}

export function generateChangeEvent(
    ev: monacoEditor.editor.IModelContentChangedEvent,
    m: IMonacoTextModel,
    oldText: string
): IMonacoModelContentChangeEvent {
    // Figure out the end position from the offset plus the length of the text we added
    const currentOffset = ev.changes[ev.changes.length - 1].rangeOffset + ev.changes[ev.changes.length - 1].text.length;
    const currentPosition = m.getPositionAt(currentOffset);

    // Create the reverse changes
    const reverseChanges = ev.changes.map(generateReverseChange.bind(undefined, oldText, m)).reverse();

    // Figure out the old position by using the first offset
    const oldOffset = ev.changes[0].rangeOffset;
    const oldPosition = m.getPositionAt(oldOffset);

    // Combine position and change to create result
    return {
        forward: ev.changes.map((c) => {
            return { ...c, position: currentPosition! };
        }),
        reverse: reverseChanges.map((r) => {
            return { ...r, position: oldPosition! };
        }),
        eol: ev.eol,
        isFlush: ev.isFlush,
        isUndoing: ev.isUndoing,
        isRedoing: ev.isRedoing,
        versionId: m.getVersionId(),
        model: m
    };
}

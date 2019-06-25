import * as CodeMirror from 'codemirror';
import { IRef } from '../slice/dataFlow';
import { SlicedExecution } from '../slice/logSlicer';
import { IGatherCell } from './cell';

/**
 * A user's selection.
 */
export type UserSelection = DefSelection | OutputSelection;

/**
 * A def selected in a cell.
 * Defined as a class so we can add a toJSON method for logging.
 */
export class DefSelection {
    public readonly editorDef: EditorDef;
    public readonly cell: IGatherCell;

    constructor(options: { editorDef: EditorDef; cell: IGatherCell }) {
        this.editorDef = options.editorDef;
        this.cell = options.cell;
    }

    public toJSON(): any {
        return {
            defType: this.editorDef.def.type,
            defLevel: this.editorDef.def.level,
            cell: this.cell
        };
    }
}

/**
 * A slice selected for a def.
 */
export type SliceSelection = {
    userSelection: UserSelection;
    slice: SlicedExecution;
};

/**
 * A def located in an editor.
 */
export type EditorDef = {
    editor: CodeMirror.Editor;
    cell: IGatherCell;
    def: IRef;
};

/**
 * An output for a cell.
 */
export type CellOutput = {
    outputIndex: number;
    element: HTMLElement;
    cell: IGatherCell;
};

/**
 * An ouput selected for a cell.
 */
export type OutputSelection = {
    outputIndex: number;
    cell: IGatherCell;
};
export function instanceOfOutputSelection(object: any): object is OutputSelection {
    return object && typeof object == 'object' && 'outputIndex' in object && 'cell' in object;
}

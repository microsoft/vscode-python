import { CodeCellModel, ICodeCellModel } from '@jupyterlab/cells';
import { nbformat } from '@jupyterlab/coreutils';
import { IOutputModel } from '@jupyterlab/rendermime';
import { UUID } from '@phosphor/coreutils';

/**
 * Generic interface for accessing data about a code cell.
 */
export interface IGatherCell {
    /**
     * The ID assigned to a cell by Jupyter Lab. This ID may change each time the notebook is open,
     * due to the implementation of Jupyter Lab.
     */
    readonly id: string;

    /**
     * Whether this cell was created by gathering code.
     */
    gathered: boolean;

    /**
     * Whether this cell's text has been changed since its last execution. Undefined behavior when
     * a cell has never been executed.
     */
    readonly dirty: boolean;

    /**
     * The cell's current text.
     */
    text: string;

    executionCount: number;

    /**
     * A unique ID generated each time a cell is executed. This lets us disambiguate between two
     * runs of a cell that have the same ID *and* execution count, if the kernel was restarted.
     * This ID should also be programmed to be *persistent*, so that even after a notebook is
     * reloaded, the cell in the same position will still have this ID.
     */
    readonly executionEventId: string;

    /**
     * A persistent ID for a cell in a notebook. This ID will stay the same even as the cell is
     * executed, and even when the cell is reloaded from the file.
     */
    readonly persistentId: string;

    outputs: nbformat.IOutput[];

    /**
     * Whether analysis or execution of this cell has yielded an error.
     */
    hasError: boolean;

    /**
     * Flag used for type checking.
     */
    readonly is_cell: boolean;

    /**
     * Create a deep copy of the cell.
     */
    deepCopy: () => IGatherCell;

    /**
     * Create a new cell from this cell. The new cell will have null execution counts, and a new
     * ID and persistent ID.
     */
    copyToNewCell: () => IGatherCell;

    /**
     * Serialize this ICell to JSON that can be stored in a notebook file, or which can be used to
     * create a new Jupyter cell.
     */
    serialize: () => nbformat.ICodeCell;
}

export function instanceOfICell(object: any): object is IGatherCell {
    return object && typeof object == 'object' && 'is_cell' in object;
}

/**
 * Abstract class for accessing cell data.
 */
export abstract class AbstractCell implements IGatherCell {
    abstract is_cell: boolean;
    abstract id: string;
    abstract executionCount: number;
    abstract executionEventId: string;
    abstract persistentId: string;
    abstract hasError: boolean;
    abstract isCode: boolean;
    abstract text: string;
    abstract gathered: boolean;
    abstract outputs: nbformat.IOutput[];
    abstract deepCopy(): AbstractCell;

    /**
     * The cell's text when it was executed, i.e., when the execution count was last changed.
     * This will be undefined if the cell has never been executed.
     */
    abstract lastExecutedText: string;

    get dirty(): boolean {
        return this.text !== this.lastExecutedText;
    }

    /**
     * This method is called by the logger to sanitize cell data before logging it. This method
     * should elide any sensitive data, like the cell's text.
     */
    toJSON(): any {
        return {
            id: this.id,
            executionCount: this.executionCount,
            persistentId: this.persistentId,
            lineCount: this.text.split('\n').length,
            isCode: this.isCode,
            hasError: this.hasError,
            gathered: this.gathered
        };
    }

    copyToNewCell(): IGatherCell {
        let clonedOutputs = this.outputs.map(output => {
            let clone = JSON.parse(JSON.stringify(output)) as nbformat.IOutput;
            if (nbformat.isExecuteResult(clone)) {
                clone.execution_count = undefined;
            }
            return clone;
        });
        return new LogCell({
            text: this.text,
            hasError: this.hasError,
            outputs: clonedOutputs
        });
    }

    serialize(): nbformat.ICodeCell {
        return {
            id: this.id,
            execution_count: this.executionCount,
            source: this.text,
            cell_type: 'code',
            outputs: this.outputs,
            metadata: {
                gathered: this.gathered,
                execution_event_id: this.executionEventId,
                persistent_id: this.persistentId
            }
        };
    }
}

/**
 * Static cell data. Provides an interfaces to cell data loaded from a log.
 */
export class LogCell extends AbstractCell {
    constructor(data: { id?: string; executionCount?: number; persistentId?: string; executionEventId?: string; hasError?: boolean; text?: string; outputs?: nbformat.IOutput[] }) {
        super();
        this.is_cell = true;
        this.id = data.id || UUID.uuid4();
        this.executionCount = data.executionCount || undefined;
        this.persistentId = data.persistentId || UUID.uuid4();
        this.executionEventId = data.executionEventId || UUID.uuid4();
        this.hasError = data.hasError || false;
        this.text = data.text || '';
        this.lastExecutedText = this.text;
        this.outputs = data.outputs || [];
        this.gathered = false;
    }

    deepCopy(): AbstractCell {
        return new LogCell(this);
    }

    readonly is_cell: boolean;
    readonly id: string;
    readonly executionCount: number;
    readonly persistentId: string;
    readonly executionEventId: string;
    readonly hasError: boolean;
    readonly isCode: boolean;
    readonly text: string;
    readonly lastExecutedText: string;
    readonly outputs: nbformat.IOutput[];
    readonly gathered: boolean;
}

/**
 * Wrapper around a code cell model created by Jupyter Lab. Provides a consistent interface to
 * lab data to other cells that have been loaded from a log.
 */
export class LabCell extends AbstractCell {
    constructor(model: ICodeCellModel) {
        super();
        this._model = model;
        /*
         * Force the initialization of a persistent ID to make sure it's set before someone tries to clone the cell.
         */
        this.persistentId;
    }

    get model(): ICodeCellModel {
        return this._model;
    }

    get id(): string {
        return this._model.id;
    }

    get persistentId(): string {
        if (!this._model.metadata.has('persistent_id')) {
            this._model.metadata.set('persistent_id', UUID.uuid4());
        }
        return this._model.metadata.get('persistent_id') as string;
    }

    get executionEventId(): string {
        return this._model.metadata.get('execution_event_id') as string;
    }

    set executionEventId(id: string) {
        this._model.metadata.set('execution_event_id', id);
    }

    get text(): string {
        return this._model.value.text;
    }

    set text(text: string) {
        this._model.value.text = text;
    }

    get lastExecutedText(): string {
        return this._model.metadata.get('last_executed_text') as string;
    }

    set lastExecutedText(text: string) {
        this._model.metadata.set('last_executed_text', text);
    }

    get executionCount(): number {
        return this._model.executionCount;
    }

    set executionCount(count: number) {
        this._model.executionCount = count;
    }

    get isCode(): boolean {
        return this._model.type == 'code';
    }

    get hasError(): boolean {
        return this.output.some(o => o.type === 'error');
    }

    get output(): IOutputModel[] {
        let outputs = [];
        if (this._model.outputs) {
            for (let i = 0; i < this._model.outputs.length; i++) {
                outputs.push(this._model.outputs.get(i));
            }
            return outputs;
        }
    }

    get outputs(): nbformat.IOutput[] {
        return this.output.map(output => output.toJSON());
    }

    get gathered(): boolean {
        return this._model.metadata.get('gathered') as boolean;
    }

    deepCopy(): LabCell {
        return new LabCell(new CodeCellModel({ id: this.id, cell: this.model.toJSON() }));
    }

    serialize(): any {
        return this._model.toJSON();
    }

    is_cell: boolean = true;
    is_outputter_cell: boolean = true;
    private _model: ICodeCellModel;
}

import { CustomDocument, CustomDocumentEditEvent } from '../../common/application/types';
import { NotebookModelChange } from '../interactive-common/interactiveWindowTypes';
import { INotebookModel } from '../types';
export class NotebookModelEditEvent implements CustomDocumentEditEvent {
    public label?: string | undefined;
    constructor(
        public readonly document: CustomDocument,
        private readonly model: INotebookModel,
        private readonly change: NotebookModelChange
    ) {
        this.label = change.kind;
    }
    public undo(): void | Thenable<void> {
        return this.model.undoEdits([{ ...this.change, source: 'undo' }]);
    }
    public redo(): void | Thenable<void> {
        return this.model.applyEdits([{ ...this.change, source: 'redo' }]);
    }
}

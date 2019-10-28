import { inject, injectable } from 'inversify';
import { Event, EventEmitter, Position, ViewColumn } from 'vscode';
import { IApplicationShell, IDocumentManager } from '../../common/application/types';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { IFileSystem } from '../../common/platform/types';
import { noop } from '../../common/utils/misc';
import { InteractiveWindowMessages } from '../interactive-common/interactiveWindowTypes';
import { ICell, IGatherExecution, IInteractiveWindowListener } from '../types';

@injectable()
export class GatherListener implements IInteractiveWindowListener {
    // tslint:disable-next-line: no-any
    private postEmitter: EventEmitter<{ message: string; payload: any }> = new EventEmitter<{ message: string; payload: any }>();

    constructor(
        @inject(IDocumentManager) private documentManager: IDocumentManager,
        @inject(IApplicationShell) private applicationShell: IApplicationShell,
        @inject(IGatherExecution) private gatherExecution: IGatherExecution,
        @inject(IFileSystem) private fileSystem: IFileSystem
    ) { }

    public dispose() {
        noop();
    }

    // tslint:disable-next-line: no-any
    public get postMessage(): Event<{ message: string; payload: any }> {
        return this.postEmitter.event;
    }

    // tslint:disable-next-line: no-any
    public onMessage(message: string, payload?: any): void {
        switch (message) {
            case InteractiveWindowMessages.GatherCode:
                if (payload) {
                    const cell = payload as ICell;
                    this.gatherCode(cell);
                }
                break;

            default:
                break;
        }
    }

    public gatherCode(payload: ICell) {
        this.gatherCodeInternal(payload).catch(err => {
            this.applicationShell.showErrorMessage(err);
        });
    }

    private gatherCodeInternal = async (cell: ICell) => {
        const slicedProgram = this.gatherExecution.gatherCode(cell);

        // Don't want to open the gathered code on top of the interactive window
        let viewColumn: ViewColumn | undefined;
        const fileNameMatch = this.documentManager.visibleTextEditors.filter(textEditor => this.fileSystem.arePathsSame(textEditor.document.fileName, cell.file));
        const definedVisibleEditors = this.documentManager.visibleTextEditors.filter(textEditor => textEditor.viewColumn !== undefined);
        if (this.documentManager.visibleTextEditors.length > 0 && fileNameMatch.length > 0) {
            // Original file is visible
            viewColumn = fileNameMatch[0].viewColumn;
        } else if (this.documentManager.visibleTextEditors.length > 0 && definedVisibleEditors.length > 0) {
            // There is a visible text editor, just not the original file. Make sure viewColumn isn't undefined
            viewColumn = definedVisibleEditors[0].viewColumn;
        } else {
            // Only one panel open and interactive window is occupying it, or original file is open but hidden
            viewColumn = ViewColumn.Beside;
        }

        // Create a new open editor with the returned program in the right panel
        const doc = await this.documentManager.openTextDocument({
            content: slicedProgram,
            language: PYTHON_LANGUAGE
        });
        const editor = await this.documentManager.showTextDocument(doc, viewColumn);

        // Edit the document so that it is dirty (add a space at the end)
        editor.edit((editBuilder) => {
            editBuilder.insert(new Position(editor.document.lineCount, 0), '\n');
        });
    }
}

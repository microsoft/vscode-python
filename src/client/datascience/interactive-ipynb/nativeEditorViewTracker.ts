import { inject, injectable, named } from 'inversify';
import { Memento, Uri } from 'vscode';
import { IExtensionSingleActivationService } from '../../activation/types';
import { UseCustomEditorApi } from '../../common/constants';
import { IDisposableRegistry, IMemento, WORKSPACE_MEMENTO } from '../../common/types';
import { INotebookEditor, INotebookEditorProvider } from '../types';
import { isUntitled } from './nativeEditorStorage';

const MEMENTO_KEY = 'nativeEditorViewTracking';
/**
 * This class tracks opened notebooks and stores the list of files in a memento. On next activation
 * this list of files is then opened.
 * Untitled files are tracked too, but they should only open if they're dirty.
 */
@injectable()
export class NativeEditorViewTracker implements IExtensionSingleActivationService {
    constructor(
        @inject(INotebookEditorProvider) private readonly editorProvider: INotebookEditorProvider,
        @inject(IMemento) @named(WORKSPACE_MEMENTO) private readonly workspaceMemento: Memento,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(UseCustomEditorApi) private readonly useCustomEditorApi: boolean
    ) {
        if (!useCustomEditorApi) {
            disposableRegistry.push(editorProvider.onDidOpenNotebookEditor(this.onOpenedEditor.bind(this)));
            disposableRegistry.push(editorProvider.onDidCloseNotebookEditor(this.onClosedEditor.bind(this)));
        }
    }

    public async activate(): Promise<void> {
        // On activate get the list and eliminate any dupes that might have snuck in.
        const set = new Set<string>(this.workspaceMemento.get<string[]>(MEMENTO_KEY) || []);
        await this.workspaceMemento.update(MEMENTO_KEY, undefined);

        // Then open each one if not using the custom editor api
        if (!this.useCustomEditorApi) {
            set.forEach((l) => {
                const uri = Uri.parse(l);
                if (uri) {
                    this.editorProvider.open(uri).ignoreErrors();
                }
            });
        }
    }

    private onOpenedEditor(editor: INotebookEditor) {
        // Save this as a file that should be reopened in this workspace
        const list = this.workspaceMemento.get<string[]>(MEMENTO_KEY) || [];
        const fileKey = editor.file.toString();

        // Skip untitled files. They have to be changed first.
        if (!list.includes(fileKey) && (!isUntitled(editor.model) || editor.isDirty)) {
            this.workspaceMemento.update(MEMENTO_KEY, [...list, fileKey]);
        } else if (isUntitled(editor.model) && editor.model) {
            editor.model.changed(this.onUntitledChanged.bind(this, editor.file));
        }
    }

    private onUntitledChanged(file: Uri) {
        const list = this.workspaceMemento.get<string[]>(MEMENTO_KEY) || [];
        const fileKey = file.toString();
        if (!list.includes(fileKey)) {
            this.workspaceMemento.update(MEMENTO_KEY, [...list, fileKey]);
        }
    }

    private onClosedEditor(editor: INotebookEditor) {
        // Save this as a file that should not be reopened in this workspace if this is the
        // last editor for this file
        const fileKey = editor.file.toString();
        if (!this.editorProvider.editors.find((e) => e.file.toString() === fileKey && e !== editor)) {
            const list = this.workspaceMemento.get<string[]>(MEMENTO_KEY) || [];
            this.workspaceMemento.update(
                MEMENTO_KEY,
                list.filter((e) => e !== fileKey)
            );
        }
    }
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { Disposable, Uri, WebviewPanel, WebviewPanelOptions } from 'vscode';
import {
    ICommandManager,
    ICustomEditorService,
    WebviewCustomEditorEditingDelegate,
    WebviewCustomEditorProvider
} from '../../client/common/application/types';
import { IDisposableRegistry } from '../../client/common/types';
import { noop } from '../../client/common/utils/misc';
import { NotebookModelChange } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { INotebookEditor, INotebookEditorProvider } from '../../client/datascience/types';
import { createTemporaryFile } from '../utils/fs';

export class MockCustomEditorService implements ICustomEditorService {
    private provider: WebviewCustomEditorProvider | undefined;
    private resolvedList = new Map<string, Thenable<void>>();
    private undoStack = new Map<string, unknown[]>();
    private redoStack = new Map<string, unknown[]>();

    constructor(private disposableRegistry: IDisposableRegistry, commandManager: ICommandManager) {
        disposableRegistry.push(
            commandManager.registerCommand('workbench.action.files.save', this.onFileSave.bind(this))
        );
        disposableRegistry.push(
            commandManager.registerCommand('workbench.action.files.saveAs', this.onFileSaveAs.bind(this))
        );
    }

    public registerWebviewCustomEditorProvider(
        _viewType: string,
        provider: WebviewCustomEditorProvider,
        _options?: WebviewPanelOptions | undefined
    ): Disposable {
        // Only support one view type, so just save the provider
        this.provider = provider;

        // Sign up for close so we can clear our resolved map
        // tslint:disable-next-line: no-any
        ((this.provider as any) as INotebookEditorProvider).onDidCloseNotebookEditor(this.closedEditor.bind(this));

        // Listen for updates so we can keep an undo/redo stack
        if (this.provider.editingDelegate) {
            this.disposableRegistry.push(this.provider.editingDelegate.onEdit(this.onEditChange.bind(this)));
        }

        return { dispose: noop };
    }
    public async openEditor(file: Uri): Promise<void> {
        if (!this.provider) {
            throw new Error('Opening before registering');
        }

        // Make sure not to resolve more than once for the same file. At least in testing.
        let resolved = this.resolvedList.get(file.toString());
        if (!resolved) {
            // Pass undefined as the webview panel. This will make the editor create a new one
            // tslint:disable-next-line: no-any
            resolved = this.provider.resolveWebviewEditor(file, (undefined as any) as WebviewPanel);
            this.resolvedList.set(file.toString(), resolved);
        }

        await resolved;
    }

    public undo(file: Uri) {
        this.popAndApply(file, this.undoStack, this.redoStack, e => {
            const nativeProvider = (this.provider as unknown) as WebviewCustomEditorEditingDelegate<
                NotebookModelChange
            >;
            nativeProvider.undoEdits(file, [e as NotebookModelChange]);
        });
    }

    public redo(file: Uri) {
        this.popAndApply(file, this.redoStack, this.undoStack, e => {
            const nativeProvider = (this.provider as unknown) as WebviewCustomEditorEditingDelegate<
                NotebookModelChange
            >;
            nativeProvider.applyEdits(file, [e as NotebookModelChange]);
        });
    }

    private popAndApply(
        file: Uri,
        from: Map<string, unknown[]>,
        to: Map<string, unknown[]>,
        apply: (element: unknown) => void
    ) {
        const key = file.toString();
        const fromStack = from.get(key);
        if (fromStack) {
            const element = fromStack.pop();
            apply(element);
            let toStack = to.get(key);
            if (toStack === undefined) {
                toStack = [];
                to.set(key, toStack);
            }
            toStack.push(element);
        }
    }

    private onFileSave(file: Uri) {
        const nativeProvider = (this.provider as unknown) as WebviewCustomEditorEditingDelegate<NotebookModelChange>;
        if (nativeProvider) {
            nativeProvider.save(file);
        }
    }

    private onFileSaveAs(file: Uri) {
        const nativeProvider = (this.provider as unknown) as WebviewCustomEditorEditingDelegate<NotebookModelChange>;
        if (nativeProvider) {
            // Just make up a new URI
            createTemporaryFile('.ipynb')
                .then(tmp => nativeProvider.saveAs(file, Uri.file(tmp.filePath)))
                .ignoreErrors();
        }
    }

    private closedEditor(editor: INotebookEditor) {
        this.resolvedList.delete(editor.file.toString());
    }

    private onEditChange(e: { readonly resource: Uri; readonly edit: unknown }) {
        let stack = this.undoStack.get(e.resource.toString());
        if (stack === undefined) {
            stack = [];
            this.undoStack.set(e.resource.toString(), stack);
        }
        stack.push(e.edit);
    }
}

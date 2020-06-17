// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import { CancellationTokenSource, Disposable, Uri, WebviewPanel, WebviewPanelOptions } from 'vscode';
import { CancellationToken } from 'vscode-languageclient/node';
import {
    CustomDocument,
    CustomEditorProvider,
    ICommandManager,
    ICustomEditorService
} from '../../client/common/application/types';
import { IDisposableRegistry } from '../../client/common/types';
import { noop } from '../../client/common/utils/misc';
import { NotebookModelChange } from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { NativeEditorProvider } from '../../client/datascience/interactive-ipynb/nativeEditorProvider';
import { INotebookStorageProvider } from '../../client/datascience/interactive-ipynb/notebookStorageProvider';
import { INotebookEditor, INotebookEditorProvider, INotebookModel } from '../../client/datascience/types';
import { createTemporaryFile } from '../utils/fs';

@injectable()
export class MockCustomEditorService implements ICustomEditorService {
    private provider: CustomEditorProvider | undefined;
    private resolvedList = new Map<string, Thenable<void> | void>();
    private undoStack = new Map<string, unknown[]>();
    private redoStack = new Map<string, unknown[]>();

    constructor(
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry,
        @inject(ICommandManager) commandManager: ICommandManager,
        @inject(INotebookStorageProvider) private readonly storage: INotebookStorageProvider
    ) {
        disposableRegistry.push(
            commandManager.registerCommand('workbench.action.files.save', this.onFileSave.bind(this))
        );
        disposableRegistry.push(
            commandManager.registerCommand('workbench.action.files.saveAs', this.onFileSaveAs.bind(this))
        );
    }

    public registerCustomEditorProvider(
        _viewType: string,
        provider: CustomEditorProvider,
        _options?: {
            readonly webviewOptions?: WebviewPanelOptions;

            /**
             * Only applies to `CustomReadonlyEditorProvider | CustomEditorProvider`.
             *
             * Indicates that the provider allows multiple editor instances to be open at the same time for
             * the same resource.
             *
             * If not set, VS Code only allows one editor instance to be open at a time for each resource. If the
             * user tries to open a second editor instance for the resource, the first one is instead moved to where
             * the second one was to be opened.
             *
             * When set, users can split and create copies of the custom editor. The custom editor must make sure it
             * can properly synchronize the states of all editor instances for a resource so that they are consistent.
             */
            readonly supportsMultipleEditorsPerDocument?: boolean;
        }
    ): Disposable {
        // Only support one view type, so just save the provider
        this.provider = provider;

        // Sign up for close so we can clear our resolved map
        // tslint:disable-next-line: no-any
        ((this.provider as any) as INotebookEditorProvider).onDidCloseNotebookEditor(this.closedEditor.bind(this));
        // tslint:disable-next-line: no-any
        ((this.provider as any) as INotebookEditorProvider).onDidOpenNotebookEditor(this.openedEditor.bind(this));

        return { dispose: noop };
    }
    public async openEditor(file: Uri, _viewType: string): Promise<void> {
        if (!this.provider) {
            throw new Error('Opening before registering');
        }

        // Make sure not to resolve more than once for the same file. At least in testing.
        let resolved = this.resolvedList.get(file.toString());
        if (!resolved) {
            // Pass undefined as the webview panel. This will make the editor create a new one
            resolved = this.provider.resolveCustomEditor(
                this.createDocument(file),
                // tslint:disable-next-line: no-any
                (undefined as any) as WebviewPanel,
                CancellationToken.None
            );
            this.resolvedList.set(file.toString(), resolved);
        }

        await resolved;
    }

    public undo(file: Uri) {
        this.popAndApply(file, this.undoStack, this.redoStack, (e) => {
            this.getModel(file)
                .then((m) => m?.undoEdits([e as NotebookModelChange]))
                .ignoreErrors();
        });
    }

    public redo(file: Uri) {
        this.popAndApply(file, this.redoStack, this.undoStack, (e) => {
            this.getModel(file)
                .then((m) => m?.applyEdits([e as NotebookModelChange]))
                .ignoreErrors();
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

    private createDocument(file: Uri): CustomDocument {
        return {
            uri: file,
            dispose: noop
        };
    }

    private async getModel(file: Uri): Promise<INotebookModel | undefined> {
        const nativeProvider = this.provider as NativeEditorProvider;
        if (nativeProvider) {
            return nativeProvider.loadModel(file);
        }
        return undefined;
    }

    private async onFileSave(file: Uri) {
        const model = await this.getModel(file);
        if (model) {
            await this.storage.save(model, new CancellationTokenSource().token);
        }
    }

    private async onFileSaveAs(file: Uri) {
        const model = await this.getModel(file);
        if (model) {
            const tmp = await createTemporaryFile('.ipynb');
            await this.storage.saveAs(model, Uri.file(tmp.filePath));
        }
    }

    private closedEditor(editor: INotebookEditor) {
        this.resolvedList.delete(editor.file.toString());
    }

    private openedEditor(editor: INotebookEditor) {
        // Listen for model changes
        this.getModel(editor.file)
            .then((m) => m?.onDidEdit(this.onEditChange.bind(this, editor.file)))
            .ignoreErrors();
    }

    private onEditChange(file: Uri, e: unknown) {
        let stack = this.undoStack.get(file.toString());
        if (stack === undefined) {
            stack = [];
            this.undoStack.set(file.toString(), stack);
        }
        stack.push(e);
    }
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IFileSystem } from '../../common/platform/types';
import { IDisposableRegistry } from '../../common/types';
import { BaseNotebookProvider } from '../interactive-common/notebookProvider';
import { INotebookEditor, INotebookEditorProvider } from '../types';

@injectable()
export class NativeNotebookProvider extends BaseNotebookProvider {
    constructor(
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(INotebookEditorProvider) private readonly editorProvider: INotebookEditorProvider,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry
    ) {
        super();
        disposables.push(editorProvider.onDidCloseNotebookEditor(this.onDidCloseNotebookEditor, this));
    }

    protected async onDidCloseNotebookEditor(editor: INotebookEditor) {
        // First find all notebooks associated with this editor (ipynb file).
        const editors = this.editorProvider.editors.filter(
            e => this.fs.arePathsSame(e.file.fsPath, editor.file.fsPath) && e !== editor
        );

        // If we have no editors for this file, then dispose the notebook.
        if (editors.length === 0) {
            await super.disposeNotebook(editor.file);
        }
    }
}

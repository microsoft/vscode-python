// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Event, EventEmitter, Uri } from 'vscode';
import { UseVSCodeNotebookEditorApi } from '../../common/constants';
import '../../common/extensions';
import { IDisposableRegistry } from '../../common/types';
import { IServiceContainer } from '../../ioc/types';
import { OurNotebookProvider, VSCodeNotebookProvider } from '../constants';
import { INotebookEditor, INotebookEditorProvider } from '../types';
import { NotebookEditorCompatibilitySupport } from './notebookEditorCompatibilitySupport';

/**
 * Notebook Editor provider used by other parts of DS code.
 * This is an adapter, that takes the VSCode api for editors (did notebook editors open, close save, etc) and
 * then exposes them in a manner we expect - i.e. INotebookEditorProvider.
 * This is also responsible for tracking all notebooks that open and then keeping the VS Code notebook models updated with changes we made to our underlying model.
 * E.g. when cells are executed the results in our model is updated, this tracks those changes and syncs VSC cells with those updates.
 */
@injectable()
export class NotebookEditorProviderWrapper implements INotebookEditorProvider {
    public get onDidChangeActiveNotebookEditor(): Event<INotebookEditor | undefined> {
        if (this.useVSCodeNotebookEditorApi) {
            return this.vscodeNotebookEditorProvider.onDidChangeActiveNotebookEditor;
        }
        return this._onDidChangeActiveNotebookEditor.event;
    }
    public get onDidCloseNotebookEditor(): Event<INotebookEditor> {
        if (this.useVSCodeNotebookEditorApi) {
            return this.vscodeNotebookEditorProvider.onDidCloseNotebookEditor;
        }
        return this._onDidCloseNotebookEditor.event;
    }
    public get onDidOpenNotebookEditor(): Event<INotebookEditor> {
        if (this.useVSCodeNotebookEditorApi) {
            return this.vscodeNotebookEditorProvider.onDidOpenNotebookEditor;
        }
        return this._onDidOpenNotebookEditor.event;
    }
    public get activeEditor(): INotebookEditor | undefined {
        if (this.useVSCodeNotebookEditorApi) {
            return this.vscodeNotebookEditorProvider.activeEditor;
        }
        return (
            this.vscodeNotebookEditorProvider.activeEditor || this.ourCustomOrOldNotebookEditorProvider?.activeEditor
        );
    }
    public get editors(): INotebookEditor[] {
        if (this.useVSCodeNotebookEditorApi) {
            return this.vscodeNotebookEditorProvider.editors;
        }
        // If a VS Code notebook is opened, then user vscode notebooks provider.
        if (this.vscodeNotebookEditorProvider.activeEditor) {
            return this.vscodeNotebookEditorProvider.editors;
        }
        const provider = this.ourCustomOrOldNotebookEditorProvider || this.vscodeNotebookEditorProvider;
        return provider.editors;
    }
    protected readonly _onDidChangeActiveNotebookEditor = new EventEmitter<INotebookEditor | undefined>();
    protected readonly _onDidOpenNotebookEditor = new EventEmitter<INotebookEditor>();
    private readonly _onDidCloseNotebookEditor = new EventEmitter<INotebookEditor>();
    private readonly ourCustomOrOldNotebookEditorProvider?: INotebookEditorProvider;
    private hasNotebookOpenedUsingVSCodeNotebook?: boolean;
    constructor(
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(UseVSCodeNotebookEditorApi) private readonly useVSCodeNotebookEditorApi: boolean,
        @inject(VSCodeNotebookProvider) private readonly vscodeNotebookEditorProvider: INotebookEditorProvider,
        @inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(NotebookEditorCompatibilitySupport)
        private readonly compatibilitySupport: NotebookEditorCompatibilitySupport
    ) {
        // If user doesn't belong to Notebooks experiment, then use old notebook editor API.
        if (!this.useVSCodeNotebookEditorApi) {
            const ourCustomOrOldNotebookEditorProvider = serviceContainer.get<INotebookEditorProvider>(
                OurNotebookProvider
            );
            this.ourCustomOrOldNotebookEditorProvider = ourCustomOrOldNotebookEditorProvider;
            ourCustomOrOldNotebookEditorProvider.onDidChangeActiveNotebookEditor(
                this._onDidChangeActiveNotebookEditor.fire,
                this._onDidChangeActiveNotebookEditor,
                this.disposables
            );
            ourCustomOrOldNotebookEditorProvider.onDidCloseNotebookEditor(
                this._onDidCloseNotebookEditor.fire,
                this._onDidCloseNotebookEditor,
                this.disposables
            );
            ourCustomOrOldNotebookEditorProvider.onDidOpenNotebookEditor(
                this._onDidOpenNotebookEditor.fire,
                this._onDidOpenNotebookEditor,
                this.disposables
            );
        }

        // Even if user doesn't belong to notebook experiment, they can open a notebook using the new vsc Notebook ui.
        this.vscodeNotebookEditorProvider.onDidChangeActiveNotebookEditor(
            (e) => {
                if (e) {
                    // Keep track of the fact that we opened something using VS Code notebooks.
                    this.hasNotebookOpenedUsingVSCodeNotebook = true;
                    this._onDidChangeActiveNotebookEditor.fire(e);
                } else if (this.hasNotebookOpenedUsingVSCodeNotebook) {
                    // We are only interested in events fired when we had already used a VS Code notebook.
                    this._onDidChangeActiveNotebookEditor.fire(e);
                    // Check if we have other VSC Notebooks opened.
                    if (!this.vscodeNotebookEditorProvider.editors.length) {
                        this.hasNotebookOpenedUsingVSCodeNotebook = false;
                    }
                }
            },
            this,
            this.disposables
        );
        // This can be done blindly, as th VSCodeNotebook API would trigger these events only if it was explicitly used.
        this.vscodeNotebookEditorProvider.onDidCloseNotebookEditor(
            this._onDidCloseNotebookEditor.fire,
            this._onDidCloseNotebookEditor,
            this.disposables
        );
        // This can be done blindly, as th VSCodeNotebook API would trigger these events only if it was explicitly used.
        this.vscodeNotebookEditorProvider.onDidOpenNotebookEditor(
            this._onDidOpenNotebookEditor.fire,
            this._onDidOpenNotebookEditor,
            this.disposables
        );
    }

    public async open(file: Uri): Promise<INotebookEditor> {
        if (this.ourCustomOrOldNotebookEditorProvider) {
            this.compatibilitySupport.canOpenWithOurNotebookEditor(file, true);
        }

        return (this.ourCustomOrOldNotebookEditorProvider || this.vscodeNotebookEditorProvider).open(file);
    }
    public async show(file: Uri): Promise<INotebookEditor | undefined> {
        return (this.ourCustomOrOldNotebookEditorProvider || this.vscodeNotebookEditorProvider).show(file);
    }
    public async createNew(contents?: string): Promise<INotebookEditor> {
        return (this.ourCustomOrOldNotebookEditorProvider || this.vscodeNotebookEditorProvider).createNew(contents);
    }
}

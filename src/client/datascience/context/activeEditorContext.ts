// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { TextEditor } from 'vscode';
import { ServerStatus } from '../../../datascience-ui/interactive-common/mainState';
import { IExtensionSingleActivationService } from '../../activation/types';
import { ICommandManager, IDocumentManager } from '../../common/application/types';
import { PYTHON_LANGUAGE } from '../../common/constants';
import { ContextKey } from '../../common/contextKey';
import { NotebookEditorSupport } from '../../common/experiments/groups';
import { traceError } from '../../common/logger';
import { IDisposable, IDisposableRegistry, IExperimentsManager } from '../../common/types';
import { setSharedProperty } from '../../telemetry';
import { EditorContexts } from '../constants';
import {
    IInteractiveWindow,
    IInteractiveWindowProvider,
    INotebook,
    INotebookEditor,
    INotebookEditorProvider,
    INotebookProvider,
    ITrustService
} from '../types';

@injectable()
export class ActiveEditorContextService implements IExtensionSingleActivationService, IDisposable {
    private readonly disposables: IDisposable[] = [];
    private nativeContext: ContextKey;
    private interactiveContext: ContextKey;
    private interactiveOrNativeContext: ContextKey;
    private pythonOrInteractiveContext: ContextKey;
    private pythonOrNativeContext: ContextKey;
    private pythonOrInteractiveOrNativeContext: ContextKey;
    private canRestartNotebookKernelContext: ContextKey;
    private hasNativeNotebookCells: ContextKey;
    private isNotebookTrusted: ContextKey;
    private isPythonFileActive: boolean = false;
    constructor(
        @inject(IInteractiveWindowProvider) private readonly interactiveProvider: IInteractiveWindowProvider,
        @inject(INotebookEditorProvider) private readonly notebookEditorProvider: INotebookEditorProvider,
        @inject(IDocumentManager) private readonly docManager: IDocumentManager,
        @inject(ICommandManager) private readonly commandManager: ICommandManager,
        @inject(IDisposableRegistry) disposables: IDisposableRegistry,
        @inject(IExperimentsManager) private readonly experiments: IExperimentsManager,
        @inject(INotebookProvider) private readonly notebookProvider: INotebookProvider,
        @inject(ITrustService) private readonly trustService: ITrustService
    ) {
        disposables.push(this);
        this.nativeContext = new ContextKey(EditorContexts.IsNativeActive, this.commandManager);
        this.canRestartNotebookKernelContext = new ContextKey(
            EditorContexts.CanRestartNotebookKernel,
            this.commandManager
        );
        this.interactiveContext = new ContextKey(EditorContexts.IsInteractiveActive, this.commandManager);
        this.interactiveOrNativeContext = new ContextKey(
            EditorContexts.IsInteractiveOrNativeActive,
            this.commandManager
        );
        this.pythonOrNativeContext = new ContextKey(EditorContexts.IsPythonOrNativeActive, this.commandManager);
        this.pythonOrInteractiveContext = new ContextKey(
            EditorContexts.IsPythonOrInteractiveActive,
            this.commandManager
        );
        this.pythonOrInteractiveOrNativeContext = new ContextKey(
            EditorContexts.IsPythonOrInteractiveOrNativeActive,
            this.commandManager
        );
        this.hasNativeNotebookCells = new ContextKey(EditorContexts.HaveNativeCells, this.commandManager);
        this.isNotebookTrusted = new ContextKey(EditorContexts.IsNotebookTrusted, this.commandManager);
    }
    public dispose() {
        this.disposables.forEach((item) => item.dispose());
    }
    public async activate(): Promise<void> {
        this.docManager.onDidChangeActiveTextEditor(this.onDidChangeActiveTextEditor, this, this.disposables);
        this.notebookProvider.onSessionStatusChanged(this.onDidKernelStatusChange, this, this.disposables);
        this.interactiveProvider.onDidChangeActiveInteractiveWindow(
            this.onDidChangeActiveInteractiveWindow,
            this,
            this.disposables
        );
        this.notebookEditorProvider.onDidChangeActiveNotebookEditor(
            this.onDidChangeActiveNotebookEditor,
            this,
            this.disposables
        );
        this.trustService.onDidSetNotebookTrust(this.onDidSetNotebookTrust, this, this.disposables);

        // Do we already have python file opened.
        if (this.docManager.activeTextEditor?.document.languageId === PYTHON_LANGUAGE) {
            this.onDidChangeActiveTextEditor(this.docManager.activeTextEditor);
        }
    }

    private updateNativeNotebookCellContext() {
        if (!this.experiments.inExperiment(NotebookEditorSupport.nativeNotebookExperiment)) {
            return;
        }
        this.hasNativeNotebookCells
            .set((this.notebookEditorProvider.activeEditor?.model?.cells?.length || 0) > 0)
            .ignoreErrors();
    }
    private onDidChangeActiveInteractiveWindow(e?: IInteractiveWindow) {
        this.interactiveContext.set(!!e).ignoreErrors();
        this.updateMergedContexts();
    }
    private onDidChangeActiveNotebookEditor(e?: INotebookEditor) {
        // This will ensure all subsequent telemetry will get the context of whether it is a custom/native/old notebook editor.
        // This is temporary, and once we ship native editor this needs to be removed.
        setSharedProperty('ds_notebookeditor', e?.type);
        this.nativeContext.set(!!e).ignoreErrors();
        this.isNotebookTrusted.set(e?.model?.isTrusted === true).ignoreErrors();
        this.updateMergedContexts();
        this.updateContextOfActiveNotebookKernel(e);
    }
    private updateContextOfActiveNotebookKernel(activeEditor?: INotebookEditor) {
        if (activeEditor) {
            this.notebookProvider
                .getOrCreateNotebook({ identity: activeEditor.file, getOnly: true })
                .then((nb) => {
                    if (activeEditor === this.notebookEditorProvider.activeEditor) {
                        const canStart = nb && nb.status !== ServerStatus.NotStarted && activeEditor.model?.isTrusted;
                        this.canRestartNotebookKernelContext.set(!!canStart).ignoreErrors();
                    }
                })
                .catch(
                    traceError.bind(undefined, 'Failed to determine if a notebook is active for the current editor')
                );
        } else {
            this.canRestartNotebookKernelContext.set(false).ignoreErrors();
        }
    }
    private onDidKernelStatusChange({ notebook }: { status: ServerStatus; notebook: INotebook }) {
        // Ok, kernel status has changed.
        const activeEditor = this.notebookEditorProvider.activeEditor;
        if (!activeEditor) {
            return;
        }
        if (activeEditor.file.toString() !== notebook.identity.toString()) {
            // Status of a notebook thats not related to active editor has changed.
            // We can ignore that.
            return;
        }
        this.updateContextOfActiveNotebookKernel(activeEditor);
    }
    private onDidChangeActiveTextEditor(e?: TextEditor) {
        this.isPythonFileActive =
            e?.document.languageId === PYTHON_LANGUAGE && !this.notebookEditorProvider.activeEditor;
        this.updateNativeNotebookCellContext();
        this.updateMergedContexts();
    }
    // When trust service says trust has changed, update context with whether the currently active notebook is trusted
    private onDidSetNotebookTrust() {
        if (this.notebookEditorProvider.activeEditor?.model !== undefined) {
            this.isNotebookTrusted.set(this.notebookEditorProvider.activeEditor?.model?.isTrusted).ignoreErrors();
        }
    }
    private updateMergedContexts() {
        this.interactiveOrNativeContext
            .set(this.nativeContext.value === true && this.interactiveContext.value === true)
            .ignoreErrors();
        this.pythonOrNativeContext
            .set(this.nativeContext.value === true || this.isPythonFileActive === true)
            .ignoreErrors();
        this.pythonOrInteractiveContext
            .set(this.interactiveContext.value === true || this.isPythonFileActive === true)
            .ignoreErrors();
        this.pythonOrInteractiveOrNativeContext
            .set(
                this.nativeContext.value === true ||
                    (this.interactiveContext.value === true && this.isPythonFileActive === true)
            )
            .ignoreErrors();
    }
}

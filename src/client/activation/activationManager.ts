// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, multiInject } from 'inversify';
import { TextDocument, workspace } from 'vscode';
import { IApplicationDiagnostics } from '../application/types';
import { IDocumentManager, IWorkspaceService } from '../common/application/types';
import { isTestExecution } from '../common/constants';
import { traceDecorators } from '../common/logger';
import { IDisposable, Resource } from '../common/types';
import { IInterpreterAutoSelectionService } from '../interpreter/autoSelection/types';
import { IInterpreterService } from '../interpreter/contracts';
import { IExtensionActivationManager, IExtensionActivationService } from './types';

@injectable()
export class ExtensionActivationManager implements IExtensionActivationManager {
    private readonly disposables: IDisposable[] = [];
    private docOpenedHandler?: IDisposable;
    private readonly activatedWorkspaces = new Set<string>();
    constructor(
        @multiInject(IExtensionActivationService) private readonly activationServices: IExtensionActivationService[],
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IInterpreterAutoSelectionService) private readonly autoSelection: IInterpreterAutoSelectionService,
        @inject(IApplicationDiagnostics) private readonly appDiagnostics: IApplicationDiagnostics,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService
    ) { }

    public dispose() {
        while (this.disposables.length > 0) {
            const disposable = this.disposables.shift();
            disposable.dispose();
        }
        if (this. docOpenedHandler){
            this.docOpenedHandler.dispose();
            this.docOpenedHandler = undefined;
        }
    }
    public async activate(): Promise<void> {
        await this.initialize();
        await this.activateWorkspace(this.getActiveResource());
    }
    protected async initialize() {
        // Get latest interpreter list.
        const mainWorkspaceUri = this.getActiveResource();
        this.interpreterService.getInterpreters(mainWorkspaceUri).ignoreErrors();
        this.addHandlers();
    }
    protected addHandlers() {
        this.disposables.push(this.workspaceService.onDidChangeWorkspaceFolders(this.onWorkspaceFoldersChanged, this));
    }
    protected addRemoveDocOpenedHandlers() {
        if (this.hasMultipleWorkspaces()) {
            if (!this.docOpenedHandler) {
                this.docOpenedHandler = this.documentManager.onDidOpenTextDocument(this.onDocOpened, this);
            }
            return;
        }
        if (this.docOpenedHandler) {
            this.docOpenedHandler.dispose();
            this.docOpenedHandler = undefined;
        }
    }
    protected onWorkspaceFoldersChanged() {
        this.addRemoveDocOpenedHandlers();
    }
    protected hasMultipleWorkspaces() {
        return this.workspaceService.hasWorkspaceFolders && this.workspaceService.workspaceFolders.length > 1;
    }
    protected onDocOpened(doc: TextDocument) {
        const key = this.getWorkspaceKey(doc.uri);
        if (this.activatedWorkspaces.has(key)) {
            return;
        }
        const folder = this.workspaceService.getWorkspaceFolder(doc.uri);
        this.activateWorkspace(folder ? folder.uri : undefined).ignoreErrors();
    }
    @traceDecorators.error('Failed to activate a worksapce')
    protected async activateWorkspace(resource: Resource) {
        const key = this.getWorkspaceKey(resource);
        this.activatedWorkspaces.add(key);

        await Promise.all(this.activationServices.map(item => item.activate(resource)));

        // When testing, do not perform health checks, as modal dialogs can be displayed.
        if (!isTestExecution()) {
            await this.appDiagnostics.performPreStartupHealthCheck(resource);
        }
        await this.autoSelection.autoSelectInterpreter(resource);
    }
    protected getWorkspaceKey(resource: Resource) {
        if (!resource) {
            return '';
        }
        const workspaceFolder = this.workspaceService.getWorkspaceFolder(resource);
        if (!workspaceFolder) {
            return '';
        }
        return workspaceFolder.uri.fsPath;
    }
    private getActiveResource(): Resource {
        if (this.documentManager.activeTextEditor && !this.documentManager.activeTextEditor.document.isUntitled) {
            return this.documentManager.activeTextEditor.document.uri;
        }
        return Array.isArray(this.workspaceService.workspaceFolders) && workspace.workspaceFolders.length > 0
            ? workspace.workspaceFolders[0].uri
            : undefined;
    }
}

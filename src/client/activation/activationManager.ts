// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, multiInject } from 'inversify';
import { TextDocument } from 'vscode';
import { IApplicationDiagnostics } from '../application/types';
import { IActiveResourceService, IDocumentManager, IWorkspaceService } from '../common/application/types';
import { PYTHON_LANGUAGE } from '../common/constants';
import { traceDecorators } from '../common/logger';
import { IDisposable, Resource } from '../common/types';
import { IInterpreterAutoSelectionService } from '../interpreter/autoSelection/types';
import { IInterpreterService } from '../interpreter/contracts';
import { IExtensionActivationManager, IExtensionActivationService, IExtensionSingleActivationService } from './types';

@injectable()
export class ExtensionActivationManager implements IExtensionActivationManager {
    public readonly activatedWorkspaces = new Set<string>();
    private readonly disposables: IDisposable[] = [];
    private docOpenedHandler?: IDisposable;
    constructor(
        @multiInject(IExtensionActivationService) private readonly activationServices: IExtensionActivationService[],
        @multiInject(IExtensionSingleActivationService) private readonly singleActivationServices: IExtensionSingleActivationService[],
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IInterpreterAutoSelectionService) private readonly autoSelection: IInterpreterAutoSelectionService,
        @inject(IApplicationDiagnostics) private readonly appDiagnostics: IApplicationDiagnostics,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IActiveResourceService) private readonly activeResourceService: IActiveResourceService
    ) {}

    public dispose() {
        while (this.disposables.length > 0) {
            const disposable = this.disposables.shift()!;
            disposable.dispose();
        }
        if (this.docOpenedHandler) {
            this.docOpenedHandler.dispose();
            this.docOpenedHandler = undefined;
        }
    }
    public async activate(): Promise<void> {
        await this.initialize();
        // Activate all activation services together.
        await Promise.all([Promise.all(this.singleActivationServices.map(item => item.activate())), this.activateWorkspace(this.activeResourceService.getActiveResource())]);
        await this.autoSelection.autoSelectInterpreter(undefined);
    }
    @traceDecorators.error('Failed to activate a workspace')
    public async activateWorkspace(resource: Resource) {
        const key = this.getWorkspaceKey(resource);
        if (this.activatedWorkspaces.has(key)) {
            return;
        }
        this.activatedWorkspaces.add(key);
        // Get latest interpreter list in the background.
        this.interpreterService.getInterpreters(resource).ignoreErrors();

        await this.autoSelection.autoSelectInterpreter(resource);
        await Promise.all(this.activationServices.map(item => item.activate(resource)));
        await this.appDiagnostics.performPreStartupHealthCheck(resource);
    }
    public async initialize() {
        this.addHandlers();
        this.addRemoveDocOpenedHandlers();
    }
    public onDocOpened(doc: TextDocument) {
        if (doc.languageId !== PYTHON_LANGUAGE) {
            return;
        }
        const key = this.getWorkspaceKey(doc.uri);
        // If we have opened a doc that does not belong to workspace, then do nothing.
        if (key === '' && this.workspaceService.hasWorkspaceFolders) {
            return;
        }
        if (this.activatedWorkspaces.has(key)) {
            return;
        }
        const folder = this.workspaceService.getWorkspaceFolder(doc.uri);
        this.activateWorkspace(folder ? folder.uri : undefined).ignoreErrors();
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
        //If an activated workspace folder was removed, delete its key
        const workspaceKeys = this.workspaceService.workspaceFolders!.map(workspaceFolder => this.getWorkspaceKey(workspaceFolder.uri));
        const activatedWkspcKeys = Array.from(this.activatedWorkspaces.keys());
        const activatedWkspcFoldersRemoved = activatedWkspcKeys.filter(item => workspaceKeys.indexOf(item) < 0);
        if (activatedWkspcFoldersRemoved.length > 0) {
            for (const folder of activatedWkspcFoldersRemoved) {
                this.activatedWorkspaces.delete(folder);
            }
        }
        this.addRemoveDocOpenedHandlers();
    }
    protected hasMultipleWorkspaces() {
        return this.workspaceService.hasWorkspaceFolders && this.workspaceService.workspaceFolders!.length > 1;
    }
    protected getWorkspaceKey(resource: Resource) {
        return this.workspaceService.getWorkspaceFolderIdentifier(resource, '');
    }
}

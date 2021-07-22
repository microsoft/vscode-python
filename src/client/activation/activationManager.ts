// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, multiInject } from 'inversify';
import { TextDocument } from 'vscode';
import { IApplicationDiagnostics } from '../application/types';
import { IActiveResourceService, IDocumentManager, IWorkspaceService } from '../common/application/types';
import { PYTHON_LANGUAGE } from '../common/constants';
import { DeprecatePythonPath } from '../common/experiments/groups';
import { traceDecorators } from '../common/logger';
import { IFileSystem } from '../common/platform/types';
import { IDisposable, IExperimentService, IInterpreterPathService, Resource } from '../common/types';
import { Deferred } from '../common/utils/async';
import { IInterpreterAutoSelectionService } from '../interpreter/autoSelection/types';
import { IInterpreterService } from '../interpreter/contracts';
import { sendActivationTelemetry } from '../telemetry/envFileTelemetry';
import { IExtensionActivationManager, IExtensionActivationService, IExtensionSingleActivationService } from './types';

@injectable()
export class ExtensionActivationManager implements IExtensionActivationManager {
    public readonly activatedWorkspaces = new Set<string>();

    protected readonly isInterpreterSetForWorkspacePromises = new Map<string, Deferred<void>>();

    private readonly disposables: IDisposable[] = [];

    private docOpenedHandler?: IDisposable;

    constructor(
        @multiInject(IExtensionActivationService) private readonly activationServices: IExtensionActivationService[],
        @multiInject(IExtensionSingleActivationService)
        private readonly singleActivationServices: IExtensionSingleActivationService[],
        @inject(IDocumentManager) private readonly documentManager: IDocumentManager,
        @inject(IInterpreterService) private readonly interpreterService: IInterpreterService,
        @inject(IInterpreterAutoSelectionService) private readonly autoSelection: IInterpreterAutoSelectionService,
        @inject(IApplicationDiagnostics) private readonly appDiagnostics: IApplicationDiagnostics,
        @inject(IWorkspaceService) private readonly workspaceService: IWorkspaceService,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem,
        @inject(IActiveResourceService) private readonly activeResourceService: IActiveResourceService,
        @inject(IExperimentService) private readonly experiments: IExperimentService,
        @inject(IInterpreterPathService) private readonly interpreterPathService: IInterpreterPathService,
    ) {}

    public dispose(): void {
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
        await Promise.all([
            Promise.all(this.singleActivationServices.map((item) => item.activate())),
            this.activateWorkspace(this.activeResourceService.getActiveResource()),
        ]);
    }

    @traceDecorators.error('Failed to activate a workspace')
    public async activateWorkspace(resource: Resource): Promise<void> {
        const key = this.getWorkspaceKey(resource);
        if (this.activatedWorkspaces.has(key)) {
            return;
        }
        this.activatedWorkspaces.add(key);

        if (this.experiments.inExperimentSync(DeprecatePythonPath.experiment)) {
            await this.interpreterPathService.copyOldInterpreterStorageValuesToNew(resource);
        }

        // Get latest interpreter list in the background.
        this.interpreterService.getInterpreters(resource).ignoreErrors();

        await sendActivationTelemetry(this.fileSystem, this.workspaceService, resource);

        await this.autoSelection.autoSelectInterpreter(resource);
        await Promise.all(this.activationServices.map((item) => item.activate(resource)));
        await this.appDiagnostics.performPreStartupHealthCheck(resource);
    }

    public async initialize(): Promise<void> {
        this.addHandlers();
        this.addRemoveDocOpenedHandlers();
    }

    public onDocOpened(doc: TextDocument): void {
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

    protected addHandlers(): void {
        this.disposables.push(this.workspaceService.onDidChangeWorkspaceFolders(this.onWorkspaceFoldersChanged, this));
    }

    protected addRemoveDocOpenedHandlers(): void {
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

    protected onWorkspaceFoldersChanged(): void {
        // If an activated workspace folder was removed, delete its key
        const workspaceKeys = this.workspaceService.workspaceFolders!.map((workspaceFolder) =>
            this.getWorkspaceKey(workspaceFolder.uri),
        );
        const activatedWkspcKeys = Array.from(this.activatedWorkspaces.keys());
        const activatedWkspcFoldersRemoved = activatedWkspcKeys.filter((item) => workspaceKeys.indexOf(item) < 0);
        if (activatedWkspcFoldersRemoved.length > 0) {
            for (const folder of activatedWkspcFoldersRemoved) {
                this.activatedWorkspaces.delete(folder);
            }
        }
        this.addRemoveDocOpenedHandlers();
    }

    protected hasMultipleWorkspaces(): boolean {
        return this.workspaceService.hasWorkspaceFolders && this.workspaceService.workspaceFolders!.length > 1;
    }

    protected getWorkspaceKey(resource: Resource): string {
        return this.workspaceService.getWorkspaceFolderIdentifier(resource, '');
    }
}

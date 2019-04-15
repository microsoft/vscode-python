// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import { DiagnosticSeverity } from 'vscode';
import { IApplicationEnvironment, IWorkspaceService } from '../../../common/application/types';
import { IFileSystem } from '../../../common/platform/types';
import { IDisposableRegistry, IPersistentState, IPersistentStateFactory, Resource } from '../../../common/types';
import { swallowExceptions } from '../../../common/utils/decorators';
import { Common, Diagnostics } from '../../../common/utils/localize';
import { IServiceContainer } from '../../../ioc/types';
import { BaseDiagnostic, BaseDiagnosticsService } from '../base';
import { IDiagnosticsCommandFactory } from '../commands/types';
import { DiagnosticCodes } from '../constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../promptHandler';
import { DiagnosticScope, IDiagnostic, IDiagnosticHandlerService } from '../types';

export class InvalidTestSettingsDiagnostic extends BaseDiagnostic {
    constructor() {
        super(
            DiagnosticCodes.InvalidTestSettingDiagnostic,
            Diagnostics.invalidTestSettings(),
            DiagnosticSeverity.Error,
            DiagnosticScope.WorkspaceFolder,
            undefined,
            'always'
        );
    }
}

export const InvalidTestSettingsDiagnosticscServiceId = 'InvalidTestSettingsDiagnosticscServiceId';

@injectable()
export class InvalidTestSettingDiagnosticsService extends BaseDiagnosticsService {
    protected readonly stateStore: IPersistentState<string[]>;
    private readonly handledWorkspaces: Set<string>;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IApplicationEnvironment) private readonly application: IApplicationEnvironment,
        @inject(IPersistentStateFactory) stateFactory: IPersistentStateFactory,
        @inject(IDiagnosticHandlerService) @named(DiagnosticCommandPromptHandlerServiceId) private readonly messageService: IDiagnosticHandlerService<MessageCommandPrompt>,
        @inject(IDiagnosticsCommandFactory) private readonly commandFactory: IDiagnosticsCommandFactory,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry) {
        super([DiagnosticCodes.InvalidEnvironmentPathVariableDiagnostic], serviceContainer, disposableRegistry, true);
        this.stateStore = stateFactory.createGlobalPersistentState<string[]>('python.unitTest.Settings', []);
        this.handledWorkspaces = new Set<string>();
    }
    public async diagnose(resource: Resource): Promise<IDiagnostic[]> {
        if (!this.shouldHandleResource(resource)) {
            return [];
        }
        const filesToBeFixed = await this.getFilesToBeFixed();
        if (filesToBeFixed.length === 0) {
            return [];
        } else {
            return [new InvalidTestSettingsDiagnostic()];
        }
    }
    public async onHandle(diagnostics: IDiagnostic[]): Promise<void> {
        // This class can only handle one type of diagnostic, hence just use first item in list.
        if (diagnostics.length === 0 || !this.canHandle(diagnostics[0]) ||
            !(diagnostics[0] instanceof InvalidTestSettingsDiagnostic)) {
            return;
        }
        const diagnostic = diagnostics[0];
        const options = [
            {
                prompt: Diagnostics.updateSettings(),
                command: {
                    diagnostic,
                    invoke: async (): Promise<void> => {
                        const filesToBeFixed = await this.getFilesToBeFixed();
                        await Promise.all(filesToBeFixed.map(file => this.fixSettingInFile(file)));
                    }
                }
            },
            { prompt: Common.noIWillDoItLater() },
            {
                prompt: Common.doNotShowAgain(),
                command: this.commandFactory.createCommand(diagnostic, { type: 'ignore', options: DiagnosticScope.Global })
            }
        ];

        await this.messageService.handle(diagnostic, { commandPrompts: options });
    }
    public getSettingsFiles() {
        if (!this.workspace.hasWorkspaceFolders) {
            return this.application.userSettingsFile ? [this.application.userSettingsFile] : [];
        }
        return this.workspace.workspaceFolders!
            .map(item => path.join(item.uri.fsPath, '.vscode', 'settings.json'))
            .concat(this.application.userSettingsFile ? [this.application.userSettingsFile] : []);
    }
    public async getFilesToBeFixed() {
        const files = this.getSettingsFiles();
        const result = await Promise.all(files.map(async file => {
            const needsFixing = await this.doesFileNeedToBeFixed(file);
            return { file, needsFixing };
        }));
        return result.filter(item => item.needsFixing).map(item => item.file);
    }
    @swallowExceptions('Failed to update settings.json')
    public async fixSettingInFile(filePath: string) {
        const fileContents = await this.fs.readFile(filePath);
        const setting = new RegExp('"python.unitTest', 'g');

        await this.fs.writeFile(filePath, fileContents.replace(setting, '"python.testing'));

        // Keep track of updated file.
        this.stateStore.value.push(filePath);
        await this.stateStore.updateValue(this.stateStore.value.slice());
    }
    @swallowExceptions('Failed to check if file needs to be fixed')
    private async doesFileNeedToBeFixed(filePath: string) {
        // If we have fixed the path to this file once before,
        // then no need to check agian. If user adds subsequently, nothing we can do,
        // as user will see warnings in editor about invalid entries.
        // This will speed up loading of extension (reduce unwanted disc IO).
        if (this.stateStore.value.indexOf(filePath) >= 0) {
            return false;
        }
        const contents = await this.fs.readFile(filePath);
        return contents.indexOf('python.unitTest.') > 0;
    }
    /**
     * Checks whether to handle a particular workspace resource.
     * If required, we'll track that resource to ensure we don't handle it again.
     * This is necessary for multi-root workspaces.
     *
     * @param {Resource} resource
     * @returns {boolean}
     * @memberof InvalidTestSettingDiagnosticsService
     */
    private shouldHandleResource(resource: Resource): boolean {
        const folder = this.workspace.getWorkspaceFolder(resource);

        if (!folder || !resource || !this.workspace.hasWorkspaceFolders) {
            if (this.handledWorkspaces.has('')) {
                return false;
            }
            this.handledWorkspaces.add('');
            return true;
        }

        if (this.handledWorkspaces.has(folder.uri.fsPath)) {
            return false;
        }
        this.handledWorkspaces.add(folder.uri.fsPath);
        return true;
    }
}

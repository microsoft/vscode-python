// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { DiagnosticSeverity, WorkspaceFolder } from 'vscode';
import { ICommandManager, IWorkspaceService } from '../../../common/application/types';
import '../../../common/extensions';
import { IFileSystem, IPlatformService } from '../../../common/platform/types';
import { IDisposableRegistry, Resource, ICurrentProcess, IPathUtils, IPersistentStateFactory, IPersistentState } from '../../../common/types';
import { IServiceContainer } from '../../../ioc/types';
import { BaseDiagnostic, BaseDiagnosticsService } from '../base';
import { IDiagnosticsCommandFactory } from '../commands/types';
import { DiagnosticCodes } from '../constants';
import { DiagnosticCommandPromptHandlerServiceId, MessageCommandPrompt } from '../promptHandler';
import { DiagnosticScope, IDiagnostic, IDiagnosticHandlerService } from '../types';
import * as vscode from 'vscode';
import { OSType } from '../../../common/utils/platform';
import { swallowExceptions } from '../../../common/utils/decorators';

const UpdateTestSettingsMessage =
    'Your launch.json file needs to be updated to change the "pythonExperimental" debug ' +
    'configurations to use the "python" debugger type, otherwise Python debugging may ' +
    'not work. Would you like to automatically update your launch.json file now?';

export class InvalidTestSettingsDiagnostic extends BaseDiagnostic {
    constructor(public readonly files: Readonly<string[]>) {
        super(
            DiagnosticCodes.InvalidDebuggerTypeDiagnostic,
            UpdateTestSettingsMessage,
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
    protected readonly messageService: IDiagnosticHandlerService<MessageCommandPrompt>;
    protected readonly stateStore: IPersistentState<string[]>;
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer,
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IPlatformService) private readonly platform: IPlatformService,
        @inject(IPersistentStateFactory) stateFactory: IPersistentStateFactory,
        @inject(IDiagnosticsCommandFactory) private readonly commandFactory: IDiagnosticsCommandFactory,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils,
        @inject(ICurrentProcess) private readonly process: ICurrentProcess,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService,
        @inject(IDisposableRegistry) disposableRegistry: IDisposableRegistry) {
        super([DiagnosticCodes.InvalidEnvironmentPathVariableDiagnostic], serviceContainer, disposableRegistry, true);
        this.messageService = serviceContainer.get<IDiagnosticHandlerService<MessageCommandPrompt>>(
            IDiagnosticHandlerService,
            DiagnosticCommandPromptHandlerServiceId
        );
        this.stateStore = stateFactory.createGlobalPersistentState<string[]>('python.unitTest-Setting', []);
    }
    public async diagnose(_resource: Resource): Promise<IDiagnostic[]> {
        const filesToBeFixed = await this.getFilesToBeFixed();
        if (filesToBeFixed.length === 0) {
            return [];
        } else {
            return [new InvalidTestSettingsDiagnostic(filesToBeFixed)];
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
                prompt: 'Yes, update settings.json',
                command: {
                    diagnostic,
                    invoke: async (): Promise<void> => {
                        await Promise.all(diagnostic.files.map(file => this.fixSettingInFile(file)));
                    }
                }
            },
            { prompt: 'Ignore' },
            {
                prompt: 'Always Ignore',
                command: this.commandFactory.createCommand(diagnostic, { type: 'ignore', options: DiagnosticScope.Global })
            },
        ];

        await this.messageService.handle(diagnostic, { commandPrompts: options });
    }
    public async getFilesToBeFixed() {
        const files = this.getSettingsFiles();
        const result = await Promise.all(files.map(async file => {
            const needsFixing = await this.doesFileNeedToBeFixed(file);
            return { file, needsFixing };
        }));

        return result.filter(item => item.needsFixing).map(item => item.file);
    }
    public async doesFileNeedToBeFixed(filePath: string) {
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
    public getSettingsFiles() {
        if (!this.workspace.hasWorkspaceFolders) {
            return [];
        }
        const userSettings = this.getUserSettingsFile();
        return this.workspace.workspaceFolders!
            .map(item => path.join(item.uri.fsPath, '.vscode', 'settings.json'))
            .concat(userSettings ? [userSettings] : []);
    }
    /**
     * Get user settings file path.
     * Documented here https://code.visualstudio.com/docs/getstarted/settings#_settings-file-locations.
     * @private
     * @returns
     * @memberof InvalidTestSettingDiagnosticsService
     */
    public getUserSettingsFile() {
        switch (this.platform.osType) {
            case OSType.OSX:
                return path.join(this.pathUtils.home, 'Library', 'Application Support', 'Code', 'User', 'settings.json');
            case OSType.Linux:
                return path.join(this.pathUtils.home, '.config', 'Code', 'User', 'settings.json');
            case OSType.Windows:
                return this.process.env.APPDATA ? path.join(this.process.env.APPDATA, 'Code', 'User', 'settings.json') : undefined;
            default:
                return;
        }
    }
    @swallowExceptions('Failed to update settings.json')
    public async fixSettingInFile(filePath: string) {
        const fileContents = await this.fs.readFile(filePath);
        const setting = new RegExp('"python.unitTest"', 'g');

        await this.fs.writeFile(filePath, fileContents.replace(setting, '"python.testing'));

        // Keep track of updated file.
        this.stateStore.value.push(filePath);
        await this.stateStore.updateValue(this.stateStore.value.slice());
    }
}

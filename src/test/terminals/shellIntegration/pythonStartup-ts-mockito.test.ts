// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import {
    EnvironmentVariableCollection,
    GlobalEnvironmentVariableCollection,
    ProgressLocation,
    Uri,
    WorkspaceConfiguration,
} from 'vscode';
import { mock, instance, when, anything, verify, reset } from 'ts-mockito';
import path from 'path';
import { expect } from 'chai';
import * as workspaceApis from '../../../client/common/vscodeApis/workspaceApis';
import { registerPythonStartup } from '../../../client/terminals/pythonStartup';
import {
    IConfigurationService,
    IExperimentService,
    IExtensionContext,
    IPythonSettings,
} from '../../../client/common/types';
import {
    IApplicationShell,
    IApplicationEnvironment,
    IWorkspaceService,
} from '../../../client/common/application/types';
import { TerminalEnvVarActivation } from '../../../client/common/experiments/groups';
import { PathUtils } from '../../../client/common/platform/pathUtils';
import { IPlatformService } from '../../../client/common/platform/types';
import { Interpreters } from '../../../client/common/utils/localize';
import { IEnvironmentVariablesProvider } from '../../../client/common/variables/types';
import { defaultShells } from '../../../client/interpreter/activation/service';
import { IEnvironmentActivationService } from '../../../client/interpreter/activation/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { TerminalEnvVarCollectionService } from '../../../client/terminals/envCollectionActivation/service';
import { ITerminalDeactivateService, IShellIntegrationDetectionService } from '../../../client/terminals/types';
import { getOSType, OSType } from '../../common';

suite('hello mockito', () => {
    let platform: IPlatformService;
    let interpreterService: IInterpreterService;
    let context: IExtensionContext;
    let shell: IApplicationShell;
    let experimentService: IExperimentService;
    let collection: EnvironmentVariableCollection;
    let globalCollection: GlobalEnvironmentVariableCollection;
    let applicationEnvironment: IApplicationEnvironment;
    let environmentActivationService: IEnvironmentActivationService;
    let workspaceService: IWorkspaceService;
    let terminalEnvVarCollectionService: TerminalEnvVarCollectionService;
    let terminalDeactivateService: ITerminalDeactivateService;

    const progressOptions = {
        location: ProgressLocation.Window,
        title: Interpreters.activatingTerminals,
    };
    let configService: IConfigurationService;
    let shellIntegrationService: IShellIntegrationDetectionService;
    const displayPath = 'display/path';
    const customShell = 'powershell';
    const defaultShell = defaultShells[getOSType()];
    let getConfigurationStub: sinon.SinonStub;
    let pythonConfig: TypeMoq.IMock<WorkspaceConfiguration>;
    let editorConfig: TypeMoq.IMock<WorkspaceConfiguration>;
    let createDirectoryStub: sinon.SinonStub;
    let copyStub: sinon.SinonStub;

    setup(() => {
        workspaceService = mock<IWorkspaceService>();
        terminalDeactivateService = mock<ITerminalDeactivateService>();
        when(terminalDeactivateService.getScriptLocation(anything(), anything())).thenResolve(undefined);
        when(terminalDeactivateService.initializeScriptParams(anything())).thenResolve();
        when(workspaceService.getWorkspaceFolder(anything())).thenReturn(undefined);
        when(workspaceService.workspaceFolders).thenReturn(undefined);
        platform = mock<IPlatformService>();
        when(platform.osType).thenReturn(getOSType());
        interpreterService = mock<IInterpreterService>();
        context = mock<IExtensionContext>();
        shell = mock<IApplicationShell>();
        const envVarProvider = mock<IEnvironmentVariablesProvider>();
        shellIntegrationService = mock<IShellIntegrationDetectionService>();
        when(shellIntegrationService.isWorking()).thenResolve(true);
        globalCollection = mock<GlobalEnvironmentVariableCollection>();
        collection = mock<EnvironmentVariableCollection>();
        when(context.environmentVariableCollection).thenReturn(instance(globalCollection));
        when(globalCollection.getScoped(anything())).thenReturn(instance(collection));
        experimentService = mock<IExperimentService>();
        when(experimentService.inExperimentSync(TerminalEnvVarActivation.experiment)).thenReturn(true);
        applicationEnvironment = mock<IApplicationEnvironment>();
        when(applicationEnvironment.shell).thenReturn(customShell);
        when(shell.withProgress(anything(), anything()))
            .thenCall((options, _) => {
                expect(options).to.deep.equal(progressOptions);
            })
            .thenResolve();
        environmentActivationService = mock<IEnvironmentActivationService>();
        when(environmentActivationService.getProcessEnvironmentVariables(anything(), anything())).thenResolve(
            process.env,
        );
        configService = mock<IConfigurationService>();
        when(configService.getSettings(anything())).thenReturn(({
            terminal: { activateEnvironment: true },
            pythonPath: displayPath,
        } as unknown) as IPythonSettings);
        when(collection.clear()).thenResolve();
        terminalEnvVarCollectionService = new TerminalEnvVarCollectionService(
            instance(platform),
            instance(interpreterService),
            instance(context),
            instance(shell),
            instance(experimentService),
            instance(applicationEnvironment),
            [],
            instance(environmentActivationService),
            instance(workspaceService),
            instance(configService),
            instance(terminalDeactivateService),
            new PathUtils(getOSType() === OSType.Windows),
            instance(shellIntegrationService),
            instance(envVarProvider),
        );

        getConfigurationStub = sinon.stub(workspaceApis, 'getConfiguration');
        createDirectoryStub = sinon.stub(workspaceApis, 'createDirectory');
        copyStub = sinon.stub(workspaceApis, 'copy');

        pythonConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        editorConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
        getConfigurationStub.callsFake((section: string) => {
            if (section === 'python') {
                return pythonConfig.object;
            }
            return editorConfig.object;
        });

        createDirectoryStub.callsFake((_) => Promise.resolve());
        copyStub.callsFake((_, __, ___) => Promise.resolve());
        when(context.storageUri).thenReturn(Uri.parse('http://www.example.com/some/path'));
    });

    teardown(() => {
        sinon.restore();
    });

    test('PYTHONSTARTUP is set when setting is enabled', async () => {
        pythonConfig.setup((p) => p.get('REPL.enableShellIntegration')).returns(() => true);
        when(collection.replace(anything(), anything(), anything())).thenResolve();
        when(collection.delete(anything())).thenResolve();
        when(context.storageUri).thenReturn(Uri.parse('http://www.example.com/some/path'));

        await registerPythonStartup(context);

        // Make sure context.environmentVariableCollection.replace is called once
        verify(collection.replace).once();
        // context.verify((c) => c.environmentVariableCollection.delete(TypeMoq.It.isAny()), TypeMoq.Times.never());
    });
});

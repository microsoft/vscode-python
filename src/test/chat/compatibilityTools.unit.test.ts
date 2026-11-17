// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import { anything, instance, mock, reset, when } from 'ts-mockito';
import {
    CancellationError,
    CancellationTokenSource,
    ConfigurationTarget,
    EventEmitter,
    Extension,
    FileSystem,
    FileType,
    LanguageModelTextPart,
    LanguageModelToolInvocationOptions,
    LanguageModelToolResult,
    Uri,
    WorkspaceFolder,
} from 'vscode';
import { PythonExtension, ResolvedEnvironment } from '../../client/api/types';
import { ConfigurePythonEnvTool } from '../../client/chat/configurePythonEnvTool';
import { CreateVirtualEnvTool } from '../../client/chat/createVirtualEnvTool';
import { GetExecutableTool } from '../../client/chat/getExecutableTool';
import { GetEnvironmentInfoTool } from '../../client/chat/getPythonEnvTool';
import { InstallPackagesTool } from '../../client/chat/installPackagesTool';
import * as listPackages from '../../client/chat/listPackagesTool';
import { SelectPythonEnvTool } from '../../client/chat/selectEnvTool';
import * as utils from '../../client/chat/utils';
import { Commands } from '../../client/common/constants';
import { IInterpreterPathService, InterpreterConfigurationScope } from '../../client/common/types';
import { Architecture } from '../../client/common/utils/platform';
import * as extensionsApi from '../../client/common/vscodeApis/extensionsApi';
import * as windowApis from '../../client/common/vscodeApis/windowApis';
import * as workspaceApis from '../../client/common/vscodeApis/workspaceApis';
import * as envExtApi from '../../client/envExt/api.internal';
import { PythonEnvironment, PythonEnvironmentApi } from '../../client/envExt/types';
import { IRecommendedEnvironmentService } from '../../client/interpreter/configuration/types';
import { IServiceContainer } from '../../client/ioc/types';
import { PythonEnvInfo } from '../../client/pythonEnvironments/base/info';
import { IDiscoveryAPI } from '../../client/pythonEnvironments/base/locator';
import { EnvironmentType } from '../../client/pythonEnvironments/info';
import * as legacyIOC from '../../client/pythonEnvironments/legacyIOC';
import * as telemetry from '../../client/telemetry';
import { EventName } from '../../client/telemetry/constants';
import { mockedVSCodeNamespaces } from '../vscode-mock';

function options<T>(input: T): LanguageModelToolInvocationOptions<T> {
    return { input, toolInvocationToken: undefined };
}

function text(result: LanguageModelToolResult): string {
    return result.content.map((part) => (part instanceof LanguageModelTextPart ? part.value : '')).join('\n');
}

suite('Older Environments tool compatibility', () => {
    let temp: string;
    let folders: WorkspaceFolder[];
    let source: CancellationTokenSource;
    let changed: EventEmitter<InterpreterConfigurationScope>;
    let getProvider: sinon.SinonStub;
    let getPublicApi: sinon.SinonStub;
    let getEnvironment: sinon.SinonStub;
    let getPackages: sinon.SinonStub;
    let managePackages: sinon.SinonStub;
    let directSelection: sinon.SinonStub;
    let recommended: sinon.SinonStub;
    let warning: sinon.SinonStub;
    let nestedTool: sinon.SinonStub;
    let command: sinon.SinonStub;
    let publicEnvironment: PythonEnvironment;
    let legacyEnvironment: ResolvedEnvironment;
    let configure: ConfigurePythonEnvTool;
    let executable: GetExecutableTool;
    let environmentInfo: GetEnvironmentInfoTool;
    let install: InstallPackagesTool;
    let create: CreateVirtualEnvTool;
    let select: SelectPythonEnvTool;

    setup(async () => {
        temp = await fs.mkdtemp(path.join(os.tmpdir(), 'python-tools-compatibility-'));
        folders = [
            { name: 'first', uri: Uri.file(path.join(temp, 'first')), index: 0 },
            { name: 'second', uri: Uri.file(path.join(temp, 'second')), index: 1 },
        ];
        await Promise.all(folders.map((folder) => fs.ensureDir(folder.uri.fsPath)));
        source = new CancellationTokenSource();
        changed = new EventEmitter<InterpreterConfigurationScope>();
        utils.resetIncompatibleProviderNotification();
        sinon.stub(envExtApi, 'useEnvExtension').returns(true);
        getProvider = sinon.stub(envExtApi, 'getPythonToolsApi').resolves(undefined);
        warning = sinon.stub(windowApis, 'showWarningMessage').resolves(undefined);
        sinon.stub(workspaceApis, 'getWorkspaceFolders').callsFake(() => folders);
        const getFolder = (resource: Uri | undefined) =>
            folders.find(
                (folder) =>
                    resource?.fsPath === folder.uri.fsPath ||
                    resource?.fsPath.startsWith(`${folder.uri.fsPath}${path.sep}`),
            );
        sinon.stub(workspaceApis, 'getWorkspaceFolder').callsFake(getFolder);
        when(mockedVSCodeNamespaces.workspace!.getWorkspaceFolder(anything())).thenCall(getFolder);
        when(mockedVSCodeNamespaces.workspace!.workspaceFolders).thenReturn(folders);
        when(mockedVSCodeNamespaces.workspace!.notebookDocuments).thenReturn([]);
        when(mockedVSCodeNamespaces.workspace!.isTrusted).thenReturn(true);
        const prefix = path.join(folders[0].uri.fsPath, '.venv');
        const python = path.join(prefix, process.platform === 'win32' ? 'python.exe' : 'python');
        publicEnvironment = {
            envId: { id: 'selected', managerId: 'ms-python.python:venv' },
            name: 'selected',
            displayName: 'Selected environment',
            displayPath: prefix,
            environmentPath: Uri.file(prefix),
            execInfo: { run: { executable: python } },
            sysPrefix: prefix,
            version: '3.13.1',
        };
        legacyEnvironment = ({
            id: 'selected',
            path: python,
            executable: { uri: Uri.file(python), sysPrefix: prefix },
            version: { major: 3, minor: 13, micro: 1, release: { level: 'final', serial: 0 }, sysVersion: '3.13.1' },
            environment: { type: 'VirtualEnvironment' },
        } as unknown) as ResolvedEnvironment;
        getEnvironment = sinon.stub().resolves(publicEnvironment);
        getPackages = sinon.stub().resolves([{ name: 'public-package', version: '2.0' }]);
        managePackages = sinon.stub().resolves();
        const publicApi: Partial<PythonEnvironmentApi> = { getEnvironment, getPackages, managePackages };
        getPublicApi = sinon.stub(envExtApi, 'getEnvExtApi').resolves(publicApi as PythonEnvironmentApi);
        const api: Partial<PythonExtension['environments']> = {
            getActiveEnvironmentPath: sinon.stub().returns({ path: python, id: 'selected' }),
            resolveEnvironment: sinon.stub().resolves(legacyEnvironment),
            known: [legacyEnvironment],
        };
        directSelection = sinon.stub(utils, 'setEnvironmentDirectlyByPath').resolves(legacyEnvironment);
        sinon
            .stub(utils, 'getEnvDetailsForResponse')
            .callsFake(
                async () => new LanguageModelToolResult([new LanguageModelTextPart('Previous environment selection')]),
            );
        sinon
            .stub(utils, 'getEnvironmentDetails')
            .callsFake(
                async (_resource, _api, _execution, _terminal, packages) =>
                    `Previous environment information ${packages ?? ''}`,
            );
        const discovery = { getEnvs: sinon.stub().returns([{} as PythonEnvInfo]) } as Partial<IDiscoveryAPI>;
        sinon.stub(legacyIOC, 'convertEnvInfoToPythonEnvironment').returns({
            id: 'selected',
            path: python,
            envType: EnvironmentType.System,
            architecture: Architecture.x64,
            sysPrefix: prefix,
            version: { major: 3, minor: 13, patch: 1, raw: '3.13.1', build: [], prerelease: [] },
        });
        recommended = sinon.stub().resolves(undefined);
        const services = mock<IServiceContainer>();
        const recommendationService = mock<IRecommendedEnvironmentService>();
        when(recommendationService.getRecommededEnvironment(anything())).thenCall(recommended);
        when(services.get<IRecommendedEnvironmentService>(IRecommendedEnvironmentService)).thenReturn(
            instance(recommendationService),
        );
        const interpreterPaths = mock<IInterpreterPathService>();
        when(interpreterPaths.onDidChange).thenReturn(changed.event);
        when(services.get<IInterpreterPathService>(IInterpreterPathService)).thenReturn(instance(interpreterPaths));
        const container = instance(services);
        create = new CreateVirtualEnvTool(
            discovery as IDiscoveryAPI,
            api as PythonExtension['environments'],
            container,
        );
        select = new SelectPythonEnvTool(api as PythonExtension['environments'], container);
        configure = new ConfigurePythonEnvTool(api as PythonExtension['environments'], container, create);
        executable = new GetExecutableTool(
            api as PythonExtension['environments'],
            container,
            discovery as IDiscoveryAPI,
        );
        environmentInfo = new GetEnvironmentInfoTool(api as PythonExtension['environments'], container);
        install = new InstallPackagesTool(
            api as PythonExtension['environments'],
            container,
            discovery as IDiscoveryAPI,
        );
        nestedTool = sinon
            .stub()
            .callsFake(async () => new LanguageModelToolResult([new LanguageModelTextPart('Previous nested tool')]));
        command = sinon.stub().callsFake(async () => {
            changed.fire({ uri: folders[0].uri, configTarget: ConfigurationTarget.Workspace });
            return publicEnvironment;
        });
        when(mockedVSCodeNamespaces.lm!.invokeTool(anything(), anything(), anything())).thenCall(nestedTool);
        when(mockedVSCodeNamespaces.commands!.executeCommand(anything(), anything())).thenCall(command);
    });

    teardown(async () => {
        source.dispose();
        changed.dispose();
        sinon.restore();
        reset(mockedVSCodeNamespaces.commands!);
        reset(mockedVSCodeNamespaces.lm!);
        reset(mockedVSCodeNamespaces.workspace!);
        await fs.remove(temp);
    });

    test('selects an explicit interpreter through the previous implementation and reports the default target', async () => {
        const pythonPath = publicEnvironment.execInfo.run.executable;
        const result = await configure.invoke(options({ pythonPath }), source.token);
        expect(text(result)).to.include('Previous environment selection').and.include(folders[0].uri.fsPath);
        expect(directSelection.firstCall.args[0]).to.equal(pythonPath);
        expect(directSelection.firstCall.args[2].fsPath).to.equal(folders[0].uri.fsPath);
        sinon.assert.calledOnce(getProvider);
        sinon.assert.notCalled(nestedTool);
    });

    test('reuses an existing user selection without reselecting or changing reuse telemetry', async () => {
        const sent = sinon.stub(telemetry, 'sendTelemetryEvent');
        directSelection.rejects(new Error('Existing selection must not be written again'));
        recommended.resolves({ reason: 'workspaceUserSelected', environment: legacyEnvironment });
        expect(text(await configure.invoke(options({}), source.token))).to.include('Previous environment selection');
        sinon.assert.notCalled(nestedTool);
        sinon.assert.notCalled(directSelection);
        const event = sent.getCalls().find((call) => call.args[0] === EventName.INVOKE_TOOL);
        expect(event?.args[2]).to.include({ resolveOutcome: 'existingWorkspaceEnv' });
    });

    test('existing-environment information does not acquire the explicit setter URI requirement', async () => {
        const existing = {
            ...legacyEnvironment,
            executable: { ...legacyEnvironment.executable, uri: undefined },
        };
        recommended.resolves({ reason: 'workspaceUserSelected', environment: existing });
        directSelection.rejects(new Error('Unexpected executable re-resolution'));
        expect(text(await configure.invoke(options({}), source.token))).to.include('Previous environment selection');
        expect((utils.getEnvDetailsForResponse as sinon.SinonStub).firstCall.args[0]).to.equal(existing);
        sinon.assert.notCalled(directSelection);
        sinon.assert.notCalled(command);
        sinon.assert.notCalled(nestedTool);
    });

    test('pins the default target before capability discovery and forwards it to the old create tool', async () => {
        const first = folders[0].uri.fsPath;
        getProvider.callsFake(async () => {
            folders = [folders[1], folders[0]];
            return undefined;
        });
        sinon.stub(create, 'shouldCreateNewVirtualEnv').resolves(true);
        expect(text(await configure.invoke(options({}), source.token))).to.include(first);
        expect(nestedTool.firstCall.args[0]).to.equal(CreateVirtualEnvTool.toolName);
        expect(nestedTool.firstCall.args[1].input.resourcePath).to.equal(first);
    });

    test('retains the old selection route when creation is not recommended', async () => {
        sinon.stub(create, 'shouldCreateNewVirtualEnv').resolves(false);
        await configure.invoke(options({ resourcePath: folders[1].uri.fsPath }), source.token);
        expect(nestedTool.firstCall.args[0]).to.equal(SelectPythonEnvTool.toolName);
        expect(nestedTool.firstCall.args[1].input.resourcePath).to.equal(folders[1].uri.fsPath);
    });

    test('restores the old enabled-Environments creation command, not the legacy Python backend', async () => {
        const result = await create.invoke(
            options({
                resourcePath: folders[0].uri.fsPath,
                packageList: ['requests'],
            }),
            source.token,
        );
        expect(text(result)).to.include('Previous environment selection');
        sinon.assert.calledOnce(command);
        expect(command.firstCall.args[0]).to.equal('python-envs.createAny');
        expect(command.firstCall.args[1]).to.deep.equal({
            quickCreate: true,
            additionalPackages: ['requests'],
            uri: folders[0].uri,
            selectEnvironment: true,
        });
    });

    test('restores the existing interpreter picker route for older Environments', async () => {
        sinon.stub(utils, 'doesWorkspaceHaveVenvOrCondaEnv').returns(legacyEnvironment);
        command.resolves({ path: publicEnvironment.execInfo.run.executable });
        expect(text(await select.invoke(options({ resourcePath: folders[0].uri.fsPath }), source.token))).to.include(
            'Previous environment selection',
        );
        expect(command.firstCall.args[0]).to.equal(Commands.Set_Interpreter);
        expect(command.firstCall.args[1].resource.fsPath).to.equal(folders[0].uri.fsPath);
    });

    test('queries environment details through the old public package API', async () => {
        const directQuery = sinon
            .stub(listPackages, 'getPythonPackagesResponse')
            .rejects(new Error('Unexpected pip fallback'));
        const result = await environmentInfo.invoke(options({}), source.token);
        expect(text(result)).to.include('public-package (2.0)').and.include(folders[0].uri.fsPath);
        expect(getEnvironment.firstCall.args[0].fsPath).to.equal(folders[0].uri.fsPath);
        sinon.assert.calledOnceWithExactly(getPackages, publicEnvironment);
        sinon.assert.notCalled(directQuery);
    });

    test('preserves the old empty-public-inventory fallback', async () => {
        getPackages.resolves([]);
        const query = sinon.stub(listPackages, 'getPythonPackagesResponse').resolves('- existing-query (1.0)');
        const result = await environmentInfo.invoke(options({}), source.token);
        expect(text(result)).to.include('existing-query');
        sinon.assert.calledOnce(query);
    });

    test('queries executable details through the previous implementation', async () => {
        const result = await executable.invoke(options({ resourcePath: folders[1].uri.toString() }), source.token);
        expect(text(result)).to.include('Previous environment information').and.include(folders[1].uri.fsPath);
        expect((utils.getEnvironmentDetails as sinon.SinonStub).firstCall.args[0].fsPath).to.equal(
            folders[1].uri.fsPath,
        );
    });

    test('installs with the old public managePackages options and the explicit second root', async () => {
        const result = await install.invoke(
            options({
                resourcePath: folders[1].uri.fsPath,
                packageList: ['requests'],
            }),
            source.token,
        );
        expect(text(result)).to.include('Successfully installed package: requests').and.include(folders[1].uri.fsPath);
        expect(getEnvironment.firstCall.args[0].fsPath).to.equal(folders[1].uri.fsPath);
        sinon.assert.calledOnceWithExactly(managePackages, publicEnvironment, { install: ['requests'] });
    });

    test('does not install after cancellation while reading the old selection', async () => {
        getEnvironment.callsFake(async () => {
            source.cancel();
            return publicEnvironment;
        });
        await assert.rejects(install.invoke(options({ packageList: ['requests'] }), source.token), CancellationError);
        sinon.assert.notCalled(managePackages);
    });

    test('does not run compatibility operations if provider acquisition is cancelled', async () => {
        getProvider.callsFake(async () => {
            source.cancel();
            return undefined;
        });
        await assert.rejects(install.invoke(options({ packageList: ['requests'] }), source.token), CancellationError);
        sinon.assert.notCalled(getPublicApi);
        sinon.assert.notCalled(managePackages);
    });

    test('rejects invalid explicit targets instead of silently choosing a workspace', async () => {
        for (const resourcePath of [
            'relative',
            'https://example.org/project',
            folders[0].uri.toString() + '?query=1',
            path.join(temp, 'outside'),
            path.join(folders[0].uri.fsPath, 'does-not-exist.py'),
        ]) {
            const result = await install.invoke(options({ resourcePath, packageList: ['requests'] }), source.token);
            expect(text(result)).to.include('operation failed');
            expect(text(result)).not.to.include('Successfully installed');
        }
        sinon.assert.notCalled(getPublicApi);
        sinon.assert.notCalled(managePackages);
    });

    test('treats an empty explicit target as omitted and uses the first workspace folder', async () => {
        const result = await install.invoke(options({ resourcePath: '', packageList: ['requests'] }), source.token);
        expect(text(result)).to.include('Successfully installed');
        expect(text(result)).to.include(folders[0].uri.fsPath);
        sinon.assert.calledOnce(managePackages);
    });

    test('preserves remote workspace URIs through compatibility validation and nested selection', async () => {
        const remoteFolder = {
            name: 'remote',
            uri: Uri.parse('vscode-remote://ssh-remote+host/workspace'),
            index: 0,
        };
        const remoteFile = Uri.parse('vscode-remote://ssh-remote+host/workspace/main.py');
        folders = [remoteFolder];
        const remoteStat = sinon.stub().callsFake(async (resource: Uri) => ({
            type: resource.toString() === remoteFolder.uri.toString() ? FileType.Directory : FileType.File,
        }));
        when(mockedVSCodeNamespaces.workspace!.fs).thenReturn(({
            stat: remoteStat,
        } as unknown) as FileSystem);
        sinon.stub(create, 'shouldCreateNewVirtualEnv').resolves(false);

        for (const [input, expected] of [
            [{}, remoteFolder.uri],
            [{ resourcePath: remoteFile.toString() }, remoteFile],
        ] as const) {
            nestedTool.resetHistory();
            remoteStat.resetHistory();

            const result = await configure.invoke(options(input), source.token);

            expect(text(result)).to.include(expected.toString());
            expect(nestedTool.firstCall.args[1].input.resourcePath).to.equal(expected.toString());
            expect((remoteStat.firstCall.args[0] as Uri).toString()).to.equal(expected.toString());
        }

        nestedTool.resetHistory();
        remoteStat.resolves({ type: FileType.Unknown });
        const invalidResult = await configure.invoke(options({}), source.token);
        expect(text(invalidResult)).to.include('operation failed').and.include(remoteFolder.uri.toString());
        sinon.assert.notCalled(nestedTool);
    });

    test('keeps the previous no-workspace install only after private capability absence', async () => {
        folders = [];
        const result = await install.invoke(options({ packageList: ['requests'] }), source.token);
        expect(text(result)).to.include('Successfully installed');
        expect(text(result)).not.to.include('NO_WORKSPACE');
        sinon.assert.calledOnce(getProvider);
        sinon.assert.calledOnce(getPublicApi);
        sinon.assert.calledOnceWithExactly(getEnvironment, undefined);
        sinon.assert.calledOnceWithExactly(managePackages, publicEnvironment, { install: ['requests'] });
    });

    test('keeps no-workspace install compatibility when the advertised private version is incompatible', async () => {
        folders = [];
        getProvider.restore();
        const operation = sinon.stub().rejects(new Error('Incompatible private operation must not run'));
        sinon.stub(extensionsApi, 'getExtension').returns(({
            isActive: true,
            exports: {
                __pythonTools: {
                    version: 2,
                    configureEnvironment: operation,
                    getEnvironment: operation,
                    installPackages: operation,
                },
            },
        } as unknown) as Extension<unknown>);

        const result = await install.invoke(options({ packageList: ['requests'] }), source.token);

        expect(text(result)).to.include('Successfully installed');
        sinon.assert.calledOnceWithExactly(getEnvironment, undefined);
        sinon.assert.calledOnceWithExactly(managePackages, publicEnvironment, { install: ['requests'] });
        sinon.assert.notCalled(operation);
    });

    for (const compatible of [false, true]) {
        test(`no-workspace reads keep the previous query flow with a ${
            compatible ? 'compatible' : 'missing'
        } private capability and never mutate selection`, async () => {
            folders = [];
            const operation = sinon.stub().rejects(new Error('No-workspace queries must not use private operations'));
            getProvider.resolves(
                compatible
                    ? {
                          version: 1,
                          configureEnvironment: operation,
                          getEnvironment: operation,
                          installPackages: operation,
                      }
                    : undefined,
            );

            expect(text(await executable.invoke(options({}), source.token))).to.include(
                'Previous environment information',
            );
            expect(text(await environmentInfo.invoke(options({}), source.token))).to.include('public-package (2.0)');

            sinon.assert.notCalled(getProvider);
            sinon.assert.notCalled(operation);
            sinon.assert.notCalled(managePackages);
            sinon.assert.notCalled(directSelection);
            sinon.assert.notCalled(command);
            sinon.assert.notCalled(nestedTool);
        });
    }

    test('an older provider still refuses no-workspace configure instead of opening pickers', async () => {
        folders = [];

        expect(text(await configure.invoke(options({}), source.token))).to.include('NO_WORKSPACE');
        sinon.assert.calledOnce(getProvider);
        sinon.assert.notCalled(directSelection);
        sinon.assert.notCalled(command);
        sinon.assert.notCalled(nestedTool);
    });

    test('an unanswered compatibility warning does not block the old operation', async () => {
        warning.returns(new Promise(() => {}));
        const result = await executable.invoke(options({}), source.token);
        expect(text(result)).to.include('Previous environment information');
        sinon.assert.calledOnce(warning);
    });

    test('a notification failure does not turn capability absence into an operation failure', async () => {
        warning.throws(new Error('Notification unavailable'));
        const result = await executable.invoke(options({}), source.token);
        expect(text(result)).to.include('Previous environment information');
    });
});

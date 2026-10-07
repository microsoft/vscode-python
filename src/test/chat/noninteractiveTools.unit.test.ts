// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { anything, instance, mock, reset, resetCalls, verify, when } from 'ts-mockito';
import {
    CancellationError,
    CancellationTokenSource,
    LanguageModelTextPart,
    LanguageModelToolInvocationOptions,
    LanguageModelToolResult,
    TextDocument,
    TextEditor,
    Uri,
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
import { IModuleInstaller } from '../../client/common/installer/types';
import { IProcessServiceFactory, IPythonExecutionFactory } from '../../client/common/process/types';
import { TerminalHelper } from '../../client/common/terminal/helper';
import { ITerminalHelper } from '../../client/common/terminal/types';
import { createDeferred } from '../../client/common/utils/async';
import * as windowApis from '../../client/common/vscodeApis/windowApis';
import * as workspaceApis from '../../client/common/vscodeApis/workspaceApis';
import { EXTENSION_ROOT_DIR } from '../../client/constants';
import * as envExtApi from '../../client/envExt/api.internal';
import { PythonToolResult, PythonToolsApi } from '../../client/envExt/pythonToolsApi';
import { PythonEnvironment } from '../../client/envExt/types';
import { IRecommendedEnvironmentService } from '../../client/interpreter/configuration/types';
import { IServiceContainer } from '../../client/ioc/types';
import { IDiscoveryAPI } from '../../client/pythonEnvironments/base/locator';
import { ModuleInstallerType } from '../../client/pythonEnvironments/info';
import { TerminalCodeExecutionProvider } from '../../client/terminals/codeExecution/terminalCodeExecution';
import { ICodeExecutionService } from '../../client/terminals/types';
import * as telemetry from '../../client/telemetry';
import { EventName } from '../../client/telemetry/constants';
import { mockedVSCodeNamespaces } from '../vscode-mock';

const root = Uri.file(path.resolve('tool workspace')).fsPath;
const resourcePath = path.join(root, 'project', 'main.py');
const environmentPath = Uri.file(path.join(root, 'selected environment'));
const pythonPath = path.join(
    environmentPath.fsPath,
    ...(process.platform === 'win32' ? ['Scripts', 'python.exe'] : ['bin', 'python']),
);
const returnedEnvironment: PythonEnvironment = {
    envId: { id: 'selected-env', managerId: 'ms-python.python:venv' },
    name: 'selected-env',
    displayName: 'Selected environment (3.13.1)',
    displayPath: environmentPath.fsPath,
    environmentPath,
    version: '3.13.1',
    sysPrefix: environmentPath.fsPath,
    execInfo: { run: { executable: pythonPath, args: ['-I'] } },
};

function options<T>(input: T): LanguageModelToolInvocationOptions<T> {
    return { input, toolInvocationToken: undefined };
}

function text(result: LanguageModelToolResult): string {
    return result.content.map((part) => (part instanceof LanguageModelTextPart ? part.value : '')).join('\n');
}

suite('Python tool model descriptions', () => {
    const tools: {
        name: string;
        modelDescription: string;
        inputSchema: { properties: Record<string, { description: string }> };
    }[] = require(path.join(EXTENSION_ROOT_DIR, 'package.json')).contributes.languageModelTools;

    test('describes isolated reuse and creation regardless of how a global interpreter was selected', () => {
        const description = tools.find((tool) => tool.name === ConfigurePythonEnvTool.toolName)!.modelDescription;

        expect(description).to.include('isolated venv, Poetry, Pipenv or non-base Conda');
        expect(description).to.include('automatically or manually').and.include('isolated Conda environment');
        expect(description).to.include('without extension prompts or pickers');
        expect(description).to.include('approval still applies and does not change target behavior');
    });

    test('describes pythonPath as exact selection, not permission to install into a global environment', () => {
        const description = tools.find((tool) => tool.name === ConfigurePythonEnvTool.toolName)!.inputSchema.properties
            .pythonPath.description;

        expect(description).to.include('exact existing').and.include('including global Python or Conda base');
        expect(description).to.include('does not allow package installation into global/base');
        expect(description).to.include('Omit it to reuse or create an isolated project environment');
    });

    test('describes install protection, recovery and compatibility boundaries', () => {
        const description = tools.find((tool) => tool.name === InstallPackagesTool.toolName)!.modelDescription;

        expect(description).to.include('ENVIRONMENT_NOT_ISOLATED').and.include('ENVIRONMENT_NOT_CONFIGURED');
        expect(description).to.include('NO_WORKSPACE').and.include('never fall back to a global installation');
        expect(description).to.include('Configure without pythonPath or select an isolated environment');
        expect(description).to.include('Older Environments versions').and.include('disabled Environments integration');
        expect(description).to.include('approval still applies and does not change these target restrictions');
    });

    for (const name of [GetExecutableTool.toolName, GetEnvironmentInfoTool.toolName]) {
        test(`${name} is described as read-only`, () => {
            expect(tools.find((tool) => tool.name === name)!.modelDescription).to.include(
                'read-only: it never creates an environment or changes the selection',
            );
        });
    }
});

suite('Noninteractive Environments-backed Python tools', () => {
    let tokenSource: CancellationTokenSource;
    let provider: PythonToolsApi;
    let getProvider: sinon.SinonStub;
    let configureEnvironment: sinon.SinonStub;
    let getEnvironment: sinon.SinonStub;
    let installPackages: sinon.SinonStub;
    let forbidden: sinon.SinonStub[];
    let configure: ConfigurePythonEnvTool;
    let executable: GetExecutableTool;
    let environmentInfo: GetEnvironmentInfoTool;
    let install: InstallPackagesTool;
    let create: CreateVirtualEnvTool;
    let select: SelectPythonEnvTool;
    type Operation = 'configure' | 'executable' | 'environment' | 'install';
    let invoke: Record<Operation, () => Promise<LanguageModelToolResult>>;
    let methods: Record<Operation, sinon.SinonStub>;
    const operations: Operation[] = ['configure', 'executable', 'environment', 'install'];

    function fail(name: string) {
        const stub = sinon.stub().throws(new Error(`Unexpected legacy or UI call: ${name}`));
        forbidden.push(stub);
        return stub;
    }

    setup(() => {
        tokenSource = new CancellationTokenSource();
        forbidden = [];
        utils.resetIncompatibleProviderNotification();
        sinon.stub(envExtApi, 'useEnvExtension').returns(true);
        configureEnvironment = sinon
            .stub()
            .resolves({ status: 'success', environment: returnedEnvironment, resourcePath });
        getEnvironment = sinon.stub().resolves({
            status: 'success',
            environment: returnedEnvironment,
            resourcePath,
            packages: [],
        });
        installPackages = sinon.stub().resolves({ status: 'success', environment: returnedEnvironment, resourcePath });
        provider = { version: 1, configureEnvironment, getEnvironment, installPackages };
        getProvider = sinon.stub(envExtApi, 'getPythonToolsApi').resolves(provider);
        forbidden.push(
            sinon.stub(envExtApi, 'getEnvExtApi').throws(new Error('Unexpected public Environments API')),
            sinon.stub(envExtApi, 'resolveEnvironment').throws(new Error('Unexpected legacy environment resolution')),
            sinon.stub(utils, 'setEnvironmentDirectlyByPath').throws(new Error('Unexpected legacy selection')),
            sinon.stub(utils, 'getEnvDisplayName').throws(new Error('Unexpected discovery during preparation')),
            sinon.stub(utils, 'doesWorkspaceHaveVenvOrCondaEnv').throws(new Error('Unexpected legacy discovery')),
            sinon.stub(utils, 'getEnvironmentDetails').throws(new Error('Unexpected legacy formatting')),
            sinon.stub(utils, 'getEnvDetailsForResponse').throws(new Error('Unexpected legacy response')),
            sinon.stub(listPackages, 'getPythonPackagesResponse').throws(new Error('Unexpected legacy package query')),
            sinon.stub(windowApis, 'showQuickPick').throws(new Error('Unexpected picker')),
        );
        const folders = [
            { uri: Uri.file(path.join(root, 'first')), name: 'first', index: 0 },
            { uri: Uri.file(path.join(root, 'second')), name: 'second', index: 1 },
        ];
        sinon.stub(workspaceApis, 'getWorkspaceFolders').returns(folders);
        when(mockedVSCodeNamespaces.workspace!.workspaceFolders).thenReturn(folders);
        when(mockedVSCodeNamespaces.workspace!.notebookDocuments).thenReturn([]);
        when(mockedVSCodeNamespaces.workspace!.isTrusted).thenReturn(true);
        resetCalls(mockedVSCodeNamespaces.commands!);
        resetCalls(mockedVSCodeNamespaces.lm!);
        when(mockedVSCodeNamespaces.commands!.executeCommand(anything(), anything())).thenCall(fail('command'));
        when(mockedVSCodeNamespaces.commands!.executeCommand(anything())).thenCall(fail('command'));
        when(mockedVSCodeNamespaces.lm!.invokeTool(anything(), anything(), anything())).thenCall(fail('nested tool'));

        const legacyApi = ({
            getActiveEnvironmentPath: fail('getActiveEnvironmentPath'),
            resolveEnvironment: fail('resolveEnvironment'),
            updateActiveEnvironmentPath: fail('updateActiveEnvironmentPath'),
            onDidChangeActiveEnvironmentPath: fail('onDidChangeActiveEnvironmentPath'),
            get known() {
                throw new Error('Unexpected legacy known environments');
            },
        } as unknown) as PythonExtension['environments'];
        const discovery = ({
            getEnvs: fail('getEnvs'),
            resolveEnv: fail('resolveEnv'),
        } as unknown) as IDiscoveryAPI;
        const services = mock<IServiceContainer>();
        when(services.get<ITerminalHelper>(ITerminalHelper)).thenReturn(({
            buildCommandForTerminal: fail('legacy shell formatter'),
        } as unknown) as ITerminalHelper);
        when(services.get<TerminalCodeExecutionProvider>(ICodeExecutionService, 'standard')).thenReturn(({
            getExecutableInfo: fail('getExecutableInfo'),
        } as unknown) as TerminalCodeExecutionProvider);
        when(services.get<IRecommendedEnvironmentService>(IRecommendedEnvironmentService)).thenReturn(({
            getRecommededEnvironment: fail('getRecommededEnvironment'),
        } as unknown) as IRecommendedEnvironmentService);
        when(services.get<IPythonExecutionFactory>(IPythonExecutionFactory)).thenReturn(({
            create: fail('python execution'),
        } as unknown) as IPythonExecutionFactory);
        when(services.get<IProcessServiceFactory>(IProcessServiceFactory)).thenReturn(({
            create: fail('process execution'),
        } as unknown) as IProcessServiceFactory);
        const container = instance(services);
        create = new CreateVirtualEnvTool(discovery, legacyApi, container);
        select = new SelectPythonEnvTool(legacyApi, container);
        configure = new ConfigurePythonEnvTool(legacyApi, container, create);
        executable = new GetExecutableTool(legacyApi, container, discovery);
        environmentInfo = new GetEnvironmentInfoTool(legacyApi, container);
        install = new InstallPackagesTool(legacyApi, container, discovery);
        invoke = {
            configure: () => configure.invoke(options({ resourcePath }), tokenSource.token),
            executable: () => executable.invoke(options({ resourcePath }), tokenSource.token),
            environment: () => environmentInfo.invoke(options({ resourcePath }), tokenSource.token),
            install: () =>
                install.invoke(options({ resourcePath, packageList: ['requests', 'numpy'] }), tokenSource.token),
        };
        methods = {
            configure: configureEnvironment,
            executable: getEnvironment,
            environment: getEnvironment,
            install: installPackages,
        };
    });

    teardown(() => {
        tokenSource.dispose();
        try {
            forbidden.forEach((stub) => sinon.assert.notCalled(stub));
            verify(mockedVSCodeNamespaces.commands!.executeCommand(anything(), anything())).never();
            verify(mockedVSCodeNamespaces.commands!.executeCommand(anything())).never();
            verify(mockedVSCodeNamespaces.lm!.invokeTool(anything(), anything(), anything())).never();
        } finally {
            sinon.restore();
            reset(mockedVSCodeNamespaces.commands!);
            reset(mockedVSCodeNamespaces.lm!);
            when(mockedVSCodeNamespaces.workspace!.workspaceFolders).thenReturn([]);
        }
    });

    test('configures an explicit interpreter using raw input and the returned environment', async () => {
        const rawResource = path.join('relative project', 'main.py');

        const result = await configure.invoke(options({ resourcePath: rawResource, pythonPath }), tokenSource.token);

        sinon.assert.calledOnceWithExactly(
            configureEnvironment,
            { resourcePath: rawResource, pythonPath },
            tokenSource.token,
        );
        expect(text(result)).to.include('has been configured').and.include(pythonPath).and.include('3.13.1');
        expect(text(result)).to.include('venv').and.include(returnedEnvironment.displayName);
    });

    test('reports a newly created environment only from the configure result', async () => {
        configureEnvironment.resolves({ status: 'success', environment: returnedEnvironment, created: true });

        expect(text(await invoke.configure())).to.include('new Python environment was created');
    });

    test('retains environment telemetry for all private tools and package-manager telemetry for installs', async () => {
        const sent = sinon.stub(telemetry, 'sendTelemetryEvent');
        for (const operation of operations) {
            await invoke[operation]();
        }
        const events = sent.getCalls().filter((call) => call.args[0] === EventName.INVOKE_TOOL);
        expect(events).to.have.length(4);
        events.forEach((call) => expect(call.args[2]).to.include({ envType: 'virtualenvironment' }));
        expect(events[3].args[2]).to.include({ installerType: 'pip', packageCount: '2' });
        expect(events[2].args[2]).to.include({ responsePackageCount: '0' });
    });

    test('retains separate creation, explicit selection and reuse telemetry outcomes', async () => {
        const sent = sinon.stub(telemetry, 'sendTelemetryEvent');
        configureEnvironment.resolves({ status: 'success', environment: returnedEnvironment, created: true });
        await invoke.configure();
        configureEnvironment.resolves({ status: 'success', environment: returnedEnvironment, created: false });
        await configure.invoke(options({ resourcePath, pythonPath }), tokenSource.token);
        await invoke.configure();
        const events = sent.getCalls().filter((call) => call.args[0] === EventName.INVOKE_TOOL);
        expect(events[0].args[2]).to.include({ resolveOutcome: 'createdVirtualEnv' });
        expect(events[1].args[2]).to.include({ resolveOutcome: 'providedEnv' });
        expect(events[2].args[2]).to.include({ resolveOutcome: 'existingWorkspaceEnv' });
    });

    test('classifies manager telemetry without recording unrecognized manager identifiers', () => {
        for (const [managerId, envType, installerType] of [
            ['ms-python.python:conda', 'conda', 'conda'],
            ['ms-python.python:poetry', 'virtualenvironment', 'poetry'],
            ['ms-python.python:system', 'unknown', 'pip'],
            ['ms-python.python:inline-script', 'virtualenvironment', 'pip'],
            ['other.extension:custom-user-content', 'unknown', 'unknown'],
        ]) {
            expect(
                utils.getPythonToolTelemetry({
                    ...returnedEnvironment,
                    envId: { id: 'test', managerId },
                }),
            ).to.deep.equal({ envType, installerType });
        }
        expect(utils.getPythonToolTelemetry(undefined)).to.deep.equal({
            envType: 'unknown',
            installerType: 'unknown',
        });
    });

    test('passes the first workspace explicitly when resourcePath is omitted for every private operation', async () => {
        const defaultPath = workspaceApis.getWorkspaceFolders()![0].uri.fsPath;
        await configure.invoke(options({}), tokenSource.token);
        await executable.invoke(options({}), tokenSource.token);
        await environmentInfo.invoke(options({}), tokenSource.token);
        await install.invoke(options({ packageList: ['requests'] }), tokenSource.token);

        sinon.assert.calledOnceWithExactly(
            configureEnvironment,
            { resourcePath: defaultPath, pythonPath: undefined },
            tokenSource.token,
        );
        sinon.assert.calledWithExactly(getEnvironment, { resourcePath: defaultPath }, tokenSource.token);
        sinon.assert.calledWithExactly(
            getEnvironment,
            { resourcePath: defaultPath, includePackages: true },
            tokenSource.token,
        );
        sinon.assert.calledOnceWithExactly(
            installPackages,
            { resourcePath: defaultPath, packages: ['requests'] },
            tokenSource.token,
        );
    });

    test('editor focus in another root does not redirect omitted configure/install targets', async () => {
        const folders = workspaceApis.getWorkspaceFolders()!;
        const document = mock<TextDocument>();
        const editor = mock<TextEditor>();
        when(document.uri).thenReturn(Uri.file(path.join(folders[1].uri.fsPath, 'main.py')));
        when(editor.document).thenReturn(instance(document));
        when(mockedVSCodeNamespaces.window!.activeTextEditor).thenReturn(instance(editor));
        try {
            await configure.invoke(options({}), tokenSource.token);
            await install.invoke(options({ packageList: ['requests'] }), tokenSource.token);
            expect(configureEnvironment.firstCall.args[0].resourcePath).to.equal(folders[0].uri.fsPath);
            expect(installPackages.firstCall.args[0].resourcePath).to.equal(folders[0].uri.fsPath);
        } finally {
            when(mockedVSCodeNamespaces.window!.activeTextEditor).thenReturn(undefined);
        }
    });

    test('never replaces explicit invalid input with the first workspace', async () => {
        configureEnvironment.resolves({ status: 'error', code: 'INVALID_RESOURCE', message: 'Invalid resource' });
        for (const resourcePath of ['relative', 'https://example.org/project']) {
            const result = await configure.invoke(options({ resourcePath }), tokenSource.token);
            expect(configureEnvironment.lastCall.args[0].resourcePath).to.equal(resourcePath);
            expect(text(result)).to.include('INVALID_RESOURCE');
        }
    });

    test('treats an empty explicit target as omitted rather than an invalid path', async () => {
        const first = workspaceApis.getWorkspaceFolders()![0].uri.fsPath;
        configureEnvironment.resolves({ status: 'success', environment: returnedEnvironment, resourcePath: first });
        await configure.invoke(options({ resourcePath: '' }), tokenSource.token);
        expect(configureEnvironment.lastCall.args[0].resourcePath).to.equal(first);
    });

    test('still reports configure errors without a picker when no workspace is open', async () => {
        (workspaceApis.getWorkspaceFolders as sinon.SinonStub).returns([]);
        when(mockedVSCodeNamespaces.workspace!.workspaceFolders).thenReturn([]);
        configureEnvironment.resolves({
            status: 'error',
            code: 'NO_WORKSPACE',
            message: 'Open a workspace folder',
        });
        expect(text(await configure.invoke(options({}), tokenSource.token))).to.include('NO_WORKSPACE');
        expect(configureEnvironment.firstCall.args[0].resourcePath).to.equal(undefined);
    });

    for (const target of [undefined, resourcePath]) {
        test(`a compatible install without a workspace reports NO_WORKSPACE for ${
            target ? 'an explicit' : 'an omitted'
        } resource without public fallback`, async () => {
            (workspaceApis.getWorkspaceFolders as sinon.SinonStub).returns([]);
            when(mockedVSCodeNamespaces.workspace!.workspaceFolders).thenReturn([]);
            installPackages.resolves({
                status: 'error',
                code: 'NO_WORKSPACE',
                message: 'Open a workspace folder before installing packages.',
            });

            const result = await install.invoke(
                options({ resourcePath: target, packageList: ['requests'] }),
                tokenSource.token,
            );

            sinon.assert.calledOnceWithExactly(
                installPackages,
                { resourcePath: target, packages: ['requests'] },
                tokenSource.token,
            );
            expect(text(result)).to.include('NO_WORKSPACE').and.include('Open a workspace folder');
            expect(text(result)).not.to.include('Successfully installed');
            sinon.assert.notCalled(configureEnvironment);
            sinon.assert.notCalled(getEnvironment);
        });
    }

    test('does not fall back to a no-workspace public install after private cancellation', async () => {
        (workspaceApis.getWorkspaceFolders as sinon.SinonStub).returns([]);
        when(mockedVSCodeNamespaces.workspace!.workspaceFolders).thenReturn([]);
        const error = new CancellationError();
        installPackages.rejects(error);

        await assert.rejects(
            install.invoke(options({ packageList: ['requests'] }), tokenSource.token),
            (actual: unknown) => actual === error,
        );
        sinon.assert.calledOnce(installPackages);
    });

    test('does not fall back to a no-workspace public install after provider activation fails', async () => {
        (workspaceApis.getWorkspaceFolders as sinon.SinonStub).returns([]);
        when(mockedVSCodeNamespaces.workspace!.workspaceFolders).thenReturn([]);
        getProvider.rejects(new Error('Provider activation failed'));

        const result = await install.invoke(options({ packageList: ['requests'] }), tokenSource.token);

        expect(text(result)).to.include('operationFailed').and.include('Provider activation failed');
        sinon.assert.notCalled(installPackages);
    });

    test('keeps an explicit second workspace instead of the first-folder default', async () => {
        const second = workspaceApis.getWorkspaceFolders()![1].uri.fsPath;
        configureEnvironment.resolves({ status: 'success', environment: returnedEnvironment, resourcePath: second });
        const result = await configure.invoke(options({ resourcePath: second }), tokenSource.token);
        sinon.assert.calledOnceWithExactly(
            configureEnvironment,
            { resourcePath: second, pythonPath: undefined },
            tokenSource.token,
        );
        expect(text(result)).to.include(`Resource: ${second}`);
        await install.invoke(options({ resourcePath: second, packageList: ['requests'] }), tokenSource.token);
        sinon.assert.calledOnceWithExactly(
            installPackages,
            { resourcePath: second, packages: ['requests'] },
            tokenSource.token,
        );
    });

    test('preserves host confirmation without provider calls or discovery during preparation', async () => {
        const packages = ['zstandard', 'numpy'];
        const configuration = await configure.prepareInvocation({ input: { resourcePath } }, tokenSource.token);
        const explicit = await configure.prepareInvocation({ input: { resourcePath, pythonPath } }, tokenSource.token);
        const installation = await install.prepareInvocation(
            { input: { resourcePath, packageList: packages } },
            tokenSource.token,
        );
        const executablePreparation = await executable.prepareInvocation(
            { input: { resourcePath } },
            tokenSource.token,
        );
        await environmentInfo.prepareInvocation({ input: { resourcePath } }, tokenSource.token);

        expect(configuration.confirmationMessages?.message).to.include('reuse an isolated environment');
        expect(configuration.confirmationMessages?.message).to.include(
            'create and select one without extension pickers',
        );
        expect(configuration.confirmationMessages?.message).to.include('automatically or manually');
        expect(configuration.confirmationMessages?.message).to.include('Conda base');
        expect(configuration.confirmationMessages?.message).to.include(resourcePath);
        expect(configuration.invocationMessage).to.include(resourcePath);
        expect(explicit.confirmationMessages?.message).to.include(pythonPath);
        expect(explicit.confirmationMessages?.message).to.include('exact existing').and.include('even if it is global');
        expect(explicit.confirmationMessages?.message).to.include(
            'installation still rejects global Python and Conda base',
        );
        expect(installation.confirmationMessages?.message).to.include('numpy, zstandard');
        expect(installation.confirmationMessages?.message).to.include('selected Python environment');
        expect(installation.confirmationMessages?.message).to.include(resourcePath);
        expect(installation.confirmationMessages?.message).to.include('isolated environment is required');
        expect(installation.confirmationMessages?.message).to.include(
            'global Python and Conda base are never modified',
        );
        expect(installation.confirmationMessages?.message).to.include('no extension pickers');
        expect(executablePreparation.invocationMessage).to.include('executable information');
        expect(packages).to.deep.equal(['zstandard', 'numpy']);
        sinon.assert.notCalled(getProvider);
        sinon.assert.notCalled(configureEnvironment);
        sinon.assert.notCalled(getEnvironment);
        sinon.assert.notCalled(installPackages);
    });

    test('prepares a no-workspace install without reading or selecting a global environment', async () => {
        (workspaceApis.getWorkspaceFolders as sinon.SinonStub).returns([]);
        when(mockedVSCodeNamespaces.workspace!.workspaceFolders).thenReturn([]);

        const prepared = await install.prepareInvocation({ input: { packageList: ['requests'] } }, tokenSource.token);

        expect(prepared.confirmationMessages?.message).to.include('an open workspace');
        expect(prepared.confirmationMessages?.message).to.include('selected isolated environment');
        expect(prepared.confirmationMessages?.message).to.include('global Python and Conda base are never modified');
        expect(prepared.invocationMessage).to.include('requests');
        sinon.assert.notCalled(getProvider);
        sinon.assert.notCalled(configureEnvironment);
        sinon.assert.notCalled(getEnvironment);
        sinon.assert.notCalled(installPackages);
    });

    test('preparing approval does not change the configure or install target behavior', async () => {
        const configuration = options({ resourcePath, pythonPath });
        const installation = options({ resourcePath, packageList: ['requests'] });

        await configure.invoke(configuration, tokenSource.token);
        await install.invoke(installation, tokenSource.token);
        await configure.prepareInvocation(configuration, tokenSource.token);
        await install.prepareInvocation(installation, tokenSource.token);
        await configure.invoke(configuration, tokenSource.token);
        await install.invoke(installation, tokenSource.token);

        sinon.assert.calledTwice(configureEnvironment);
        sinon.assert.calledTwice(installPackages);
        expect(configureEnvironment.secondCall.args).to.deep.equal(configureEnvironment.firstCall.args);
        expect(installPackages.secondCall.args).to.deep.equal(installPackages.firstCall.args);
        sinon.assert.notCalled(getEnvironment);
    });

    test('discloses the default first workspace in preparation for all exposed tools', async () => {
        const target = workspaceApis.getWorkspaceFolders()![0].uri.fsPath;
        const prepared = [
            await configure.prepareInvocation({ input: {} }, tokenSource.token),
            await executable.prepareInvocation({ input: {} }, tokenSource.token),
            await environmentInfo.prepareInvocation({ input: {} }, tokenSource.token),
            await install.prepareInvocation({ input: { packageList: ['requests'] } }, tokenSource.token),
        ];
        prepared.forEach((invocation) => expect(invocation.invocationMessage).to.include(target));
        expect(prepared[0].confirmationMessages?.message).to.include(target);
        expect(prepared[3].confirmationMessages?.message).to.include(target);
        sinon.assert.notCalled(getProvider);
    });

    test('uses the complete activatedRun command and arguments without mixing in run arguments', async () => {
        const command = {
            executable: path.join(root, 'manager directory', process.platform === 'win32' ? 'conda.exe' : 'conda'),
            args: ['run', '--prefix', environmentPath.fsPath, 'python'],
        };
        getEnvironment.resolves({
            status: 'success',
            environment: {
                ...returnedEnvironment,
                execInfo: { ...returnedEnvironment.execInfo, activatedRun: command },
            },
        });

        const result = await invoke.executable();

        const expectedArgs = `'run' '--prefix' '${environmentPath.fsPath}' 'python'`;
        const posixExecutable = command.executable.replace(/\\/g, '/');
        expect(text(result)).to.include(pythonPath);
        expect(text(result)).to.include(`PowerShell command prefix: \`& '${command.executable}' ${expectedArgs}\``);
        expect(text(result)).to.include(
            `POSIX shell (including Git Bash) command prefix: \`'${posixExecutable}' ${expectedArgs}\``,
        );
        expect(text(result)).not.to.include('-I');
    });

    test('labels runnable shell-specific syntax for an executable path with spaces', async () => {
        const result = await invoke.executable();
        const expectedPowerShell = `& '${pythonPath}' '-I'`;
        const expectedPosix = `'${pythonPath.replace(/\\/g, '/')}' '-I'`;

        expect(text(result)).to.include(`PowerShell command prefix: \`${expectedPowerShell}\``);
        expect(text(result)).to.include(`POSIX shell (including Git Bash) command prefix: \`${expectedPosix}\``);
        expect(text(result)).to.include(`PowerShell: \`${expectedPowerShell} sample.py\``);
        expect(text(result)).to.include(`\`${expectedPowerShell} -c "import sys;..."\``);
        expect(text(result)).to.include(`POSIX shell (including Git Bash): \`${expectedPosix} sample.py\``);
        expect(text(result)).not.to.include('Command Prompt');
    });

    test('quotes unspaced Windows Conda prefix arguments without discarding backslashes', async () => {
        const command = {
            executable: path.join(path.dirname(pythonPath), process.platform === 'win32' ? 'conda.exe' : 'conda'),
            args: ['run', '--prefix', String.raw`C:\Miniconda3\envs\demo`, 'python'],
        };
        getEnvironment.resolves({
            status: 'success',
            environment: {
                ...returnedEnvironment,
                execInfo: { ...returnedEnvironment.execInfo, activatedRun: command },
            },
        });

        const result = await invoke.executable();

        const expectedArgs = String.raw`'run' '--prefix' 'C:\Miniconda3\envs\demo' 'python'`;
        const posixExecutable = command.executable.replace(/\\/g, '/');
        expect(text(result)).to.include(`PowerShell command prefix: \`& '${command.executable}' ${expectedArgs}\``);
        expect(text(result)).to.include(
            `POSIX shell (including Git Bash) command prefix: \`'${posixExecutable}' ${expectedArgs}\``,
        );
    });

    test('escapes apostrophes in the executable and every argument as shell literals', async () => {
        const command = {
            executable: path.join(path.parse(root).root, 'work', "O'Brien", '.venv', 'Scripts', 'python.exe'),
            args: ["O'Brien", "environment's value"],
        };
        getEnvironment.resolves({
            status: 'success',
            environment: { ...returnedEnvironment, execInfo: { run: command } },
        });

        const result = await invoke.executable();

        const powershellExecutable = command.executable.replace("O'Brien", "O''Brien");
        const posixExecutable = command.executable.replace(/\\/g, '/').replace("O'Brien", "O'\\''Brien");
        expect(text(result)).to.include(
            `PowerShell command prefix: \`& '${powershellExecutable}' 'O''Brien' 'environment''s value'\``,
        );
        expect(text(result)).to.include(
            `POSIX shell (including Git Bash) command prefix: \`'${posixExecutable}' 'O'\\''Brien' 'environment'\\''s value'\``,
        );
    });

    test('quotes empty arguments and shell metacharacters without allowing expansion', async () => {
        const command = {
            executable: pythonPath,
            args: ['', '$HOME', 'semi;colon', 'a"b', '`literal', '!history', 'back\\slash'],
        };
        getEnvironment.resolves({
            status: 'success',
            environment: { ...returnedEnvironment, execInfo: { run: command } },
        });

        const result = await invoke.executable();

        const expectedArgs = "'' '$HOME' 'semi;colon' 'a\"b' '`literal' '!history' 'back\\slash'";
        expect(text(result)).to.include(`PowerShell command prefix: \`& '${pythonPath}' ${expectedArgs}\``);
        expect(text(result)).to.include(
            `POSIX shell (including Git Bash) command prefix: \`'${pythonPath.replace(/\\/g, '/')}' ${expectedArgs}\``,
        );
    });

    test('does not inherit run arguments when activatedRun has none', async () => {
        getEnvironment.resolves({
            status: 'success',
            environment: {
                ...returnedEnvironment,
                execInfo: { ...returnedEnvironment.execInfo, activatedRun: { executable: pythonPath } },
            },
        });

        const result = await invoke.executable();

        expect(text(result)).to.include(`PowerShell command prefix: \`& '${pythonPath}'\``);
        expect(text(result)).to.include(
            `POSIX shell (including Git Bash) command prefix: \`'${pythonPath.replace(/\\/g, '/')}'\``,
        );
        expect(text(result)).not.to.include('-I');
    });

    test('queries packages and environment together, including an empty package list', async () => {
        const result = await invoke.environment();

        sinon.assert.calledOnceWithExactly(getEnvironment, { resourcePath, includePackages: true }, tokenSource.token);
        expect(text(result))
            .to.include(returnedEnvironment.displayName)
            .and.include('No Python packages are installed');
    });

    test('formats package DTOs from the same returned environment', async () => {
        getEnvironment.resolves({
            status: 'success',
            environment: returnedEnvironment,
            packages: [{ name: 'numpy', version: '2.3.0' }, { name: 'local-project' }],
        });

        const result = await invoke.environment();

        expect(text(result)).to.include('- numpy (2.3.0)').and.include('- local-project').and.include(pythonPath);
    });

    test('does not treat a missing requested package list as empty or use a fallback', async () => {
        getEnvironment.resolves({ status: 'success', environment: returnedEnvironment });

        const result = await invoke.environment();

        expect(text(result)).to.include('did not return the requested package information');
        expect(text(result)).not.to.include('No Python packages are installed');
    });

    test('installs only through the authoritative private operation and reports its environment', async () => {
        const result = await invoke.install();

        sinon.assert.calledOnceWithExactly(
            installPackages,
            { resourcePath, packages: ['requests', 'numpy'] },
            tokenSource.token,
        );
        sinon.assert.notCalled(getEnvironment);
        expect(text(result)).to.include('Successfully installed packages: requests, numpy').and.include(pythonPath);
    });

    for (const manager of ['system', 'conda']) {
        test(`an explicit ${manager} pythonPath remains selectable and readable but install rejection never falls back`, async () => {
            const prefix = path.join(root, manager === 'system' ? 'global Python' : 'Conda base');
            const executable = path.join(prefix, process.platform === 'win32' ? 'python.exe' : 'python');
            const globalEnvironment: PythonEnvironment = {
                ...returnedEnvironment,
                envId: { id: prefix, managerId: `ms-python.python:${manager}` },
                name: manager === 'system' ? 'global' : 'base',
                displayName: manager === 'system' ? 'Global Python' : 'Conda base',
                environmentPath: Uri.file(prefix),
                displayPath: prefix,
                sysPrefix: prefix,
                execInfo: { run: { executable } },
            };
            configureEnvironment.resolves({
                status: 'success',
                environment: globalEnvironment,
                created: false,
                resourcePath,
            });
            getEnvironment.resolves({ status: 'success', environment: globalEnvironment, packages: [], resourcePath });
            const guidance =
                'Configure without pythonPath or select an isolated environment before installing packages.';
            installPackages.resolves({
                status: 'error',
                code: 'ENVIRONMENT_NOT_ISOLATED',
                message: guidance,
                environment: globalEnvironment,
                resourcePath,
            });

            const configured = await configure.invoke(
                options({ resourcePath, pythonPath: executable }),
                tokenSource.token,
            );
            expect(text(configured)).to.include(executable).and.include('has been configured');
            expect(text(configured)).not.to.include('new Python environment was created');
            expect(text(await invoke.executable())).to.include(executable);
            expect(text(await invoke.environment())).to.include(executable);
            const installed = await invoke.install();

            expect(text(installed)).to.include('ENVIRONMENT_NOT_ISOLATED').and.include(guidance);
            expect(text(installed)).not.to.include('Successfully installed');
            sinon.assert.calledOnceWithExactly(
                configureEnvironment,
                { resourcePath, pythonPath: executable },
                tokenSource.token,
            );
            sinon.assert.calledTwice(getEnvironment);
            sinon.assert.calledOnce(installPackages);
        });
    }

    for (const operation of ['executable', 'environment', 'install'] as const) {
        test(`${operation} preserves ENVIRONMENT_NOT_CONFIGURED without automatically configuring a target`, async () => {
            methods[operation].resolves({
                status: 'error',
                code: 'ENVIRONMENT_NOT_CONFIGURED',
                message: 'Configure a Python environment first.',
                resourcePath,
            });

            expect(text(await invoke[operation]())).to.include('ENVIRONMENT_NOT_CONFIGURED');
            sinon.assert.notCalled(configureEnvironment);
            if (operation !== 'install') {
                sinon.assert.notCalled(installPackages);
            }
        });
    }

    test('returns backend validation of an empty package list without a picker', async () => {
        installPackages.resolves({
            status: 'error',
            code: 'invalidPackages',
            message: 'At least one package is required.',
        });

        const result = await install.invoke(options({ resourcePath, packageList: [] }), tokenSource.token);

        sinon.assert.calledOnceWithExactly(installPackages, { resourcePath, packages: [] }, tokenSource.token);
        expect(text(result)).to.include('invalidPackages').and.not.include('Successfully installed');
    });

    test('preserves a partial installation failure and its authoritative environment without claiming success', async () => {
        installPackages.resolves({
            status: 'error',
            code: 'installFailed',
            message: 'Some packages could not be installed.',
            environment: returnedEnvironment,
            resourcePath,
        });

        const result = await invoke.install();

        expect(text(result)).to.include('installFailed').and.include('Some packages').and.include(pythonPath);
        expect(text(result)).not.to.include('Successfully installed');
    });

    test('preserves a partial configuration failure instead of claiming an environment was configured', async () => {
        configureEnvironment.resolves({
            status: 'error',
            code: 'selectionFailed',
            message: 'The environment was created but could not be selected.',
            environment: returnedEnvironment,
        });

        const result = await invoke.configure();

        expect(text(result)).to.include('selectionFailed').and.include('could not be selected').and.include(pythonPath);
        expect(text(result)).not.to.include('has been configured');
    });

    test('converts optional-provider activation failures into a tool result', async () => {
        getProvider.rejects(new Error('Provider activation failed'));

        expect(text(await invoke.configure())).to.include('Provider activation failed');
        sinon.assert.notCalled(configureEnvironment);
    });

    test('does not mutate after cancellation while loading the provider', async () => {
        getProvider.callsFake(async () => {
            tokenSource.cancel();
            return provider;
        });

        await assert.rejects(invoke.configure(), (error: unknown) => error instanceof CancellationError);
        sinon.assert.notCalled(configureEnvironment);
    });

    test('cancels pending provider acquisition without invoking an environment operation', async () => {
        const activation = createDeferred<PythonToolsApi>();
        getProvider.returns(activation.promise);
        const invocation = invoke.configure();
        tokenSource.cancel();

        await assert.rejects(invocation, (error: unknown) => error instanceof CancellationError);
        activation.resolve(provider);
        sinon.assert.notCalled(configureEnvironment);
    });

    for (const operation of operations) {
        test(`${operation} waits for backend cleanup before reporting cancellation`, async () => {
            const started = createDeferred();
            const cleanup = createDeferred<PythonToolResult>();
            const cancellation = new CancellationError();
            methods[operation].callsFake((_request, token) => {
                expect(token).to.equal(tokenSource.token);
                started.resolve();
                return cleanup.promise;
            });
            let settled = false;
            const invocation = invoke[operation]();
            void invocation.then(
                () => {
                    settled = true;
                },
                () => {
                    settled = true;
                },
            );
            await started.promise;
            tokenSource.cancel();
            await new Promise<void>((resolve) => setImmediate(resolve));
            const settledBeforeCleanup = settled;
            cleanup.reject(cancellation);

            await assert.rejects(invocation, (error: unknown) => error === cancellation);
            expect(settledBeforeCleanup).to.equal(false);
            expect(settled).to.equal(true);
        });

        test(`${operation} preserves a cleanup-failure result after cancellation`, async () => {
            const started = createDeferred();
            const cleanup = createDeferred<PythonToolResult>();
            methods[operation].callsFake((_request, token) => {
                expect(token).to.equal(tokenSource.token);
                started.resolve();
                return cleanup.promise;
            });
            const invocation = invoke[operation]();
            await started.promise;
            tokenSource.cancel();
            cleanup.resolve({
                status: 'error',
                code: 'PROCESS_TERMINATION_FAILED',
                message: 'Could not confirm the owned process stopped.',
                environment: returnedEnvironment,
                resourcePath,
            });

            const result = await invocation;

            expect(text(result)).to.include('PROCESS_TERMINATION_FAILED').and.include('Could not confirm');
            expect(text(result)).to.include(pythonPath);
            expect(text(result)).not.to.include('Successfully installed').and.not.include('has been configured');
        });

        test(`${operation} reports capability absence separately from operation results`, async () => {
            getProvider.resolves(undefined);

            expect(await utils.invokePythonTool(() => methods[operation](), tokenSource.token)).to.equal(
                utils.PYTHON_TOOLS_UNAVAILABLE,
            );
            sinon.assert.notCalled(methods[operation]);
        });

        test(`${operation} never treats a private unsupported-provider error as permission to fall back`, async () => {
            methods[operation].resolves({
                status: 'error',
                code: 'unsupportedProvider',
                message: 'Operation failed after starting',
            });
            expect(text(await invoke[operation]())).to.include('Operation failed after starting');
            sinon.assert.calledOnce(methods[operation]);
        });

        test(`${operation} propagates a real CancellationError without fallback`, async () => {
            const error = new CancellationError();
            methods[operation].rejects(error);

            await assert.rejects(invoke[operation](), (actual: unknown) => actual === error);
        });

        test(`${operation} returns operational errors instead of exposing extension UI`, async () => {
            methods[operation].rejects(new Error('Backend operation failed'));

            expect(text(await invoke[operation]()))
                .to.include('operationFailed')
                .and.include('Backend operation failed');
        });

        test(`${operation} returns an invalid-result message for a missing provider response`, async () => {
            methods[operation].resolves(undefined);

            expect(text(await invoke[operation]())).to.include('invalid tools API result');
        });

        test(`${operation} respects workspace trust before contacting the provider`, async () => {
            when(mockedVSCodeNamespaces.workspace!.isTrusted).thenReturn(false);

            expect(text(await invoke[operation]())).to.include('untrusted workspace');
            sinon.assert.notCalled(getProvider);
        });

        test(`${operation} does not load the provider when already cancelled`, async () => {
            tokenSource.cancel();

            await assert.rejects(invoke[operation](), (error: unknown) => error instanceof CancellationError);
            sinon.assert.notCalled(getProvider);
        });
    }

    test('warns the user once per session when the provider is incompatible', async () => {
        const warning = sinon.stub(windowApis, 'showWarningMessage').resolves(undefined);
        getProvider.resolves(undefined);

        await utils.invokePythonTool(() => configureEnvironment(), tokenSource.token);
        await utils.invokePythonTool(() => getEnvironment(), tokenSource.token);
        await utils.invokePythonTool(() => installPackages(), tokenSource.token);

        sinon.assert.calledOnce(warning);
        expect(warning.firstCall.args[0]).to.include('compatibility mode').and.include('may show prompts');
        expect(warning.firstCall.args[1]).to.equal('Update Python Environments');
    });

    test('opens the Environments extension page when the user accepts the update prompt', async () => {
        (sinon.stub(windowApis, 'showWarningMessage') as sinon.SinonStub).resolves('Update Python Environments');
        getProvider.resolves(undefined);

        await utils.invokePythonTool(() => configureEnvironment(), tokenSource.token);
        await new Promise<void>((resolve) => setImmediate(resolve));

        verify(mockedVSCodeNamespaces.commands!.executeCommand('extension.open', envExtApi.ENVS_EXTENSION_ID)).once();
        // This is the one command the suite intentionally allows, so clear the shared guards it tripped.
        forbidden.forEach((stub) => stub.resetHistory());
        reset(mockedVSCodeNamespaces.commands!);
    });

    test('keeps the original notebook refusal for every exposed tool', async () => {
        const notebookPath = path.join(root, 'analysis.ipynb');
        const results = await Promise.all([
            configure.invoke(options({ resourcePath: notebookPath, pythonPath }), tokenSource.token),
            executable.invoke(options({ resourcePath: notebookPath }), tokenSource.token),
            environmentInfo.invoke(options({ resourcePath: notebookPath }), tokenSource.token),
            install.invoke(options({ resourcePath: notebookPath, packageList: ['numpy'] }), tokenSource.token),
        ]);

        results.forEach((result) => expect(text(result)).to.include('cannot be used for Jupyter Notebooks'));
        sinon.assert.notCalled(getProvider);
        sinon.assert.notCalled(configureEnvironment);
        sinon.assert.notCalled(getEnvironment);
        sinon.assert.notCalled(installPackages);
    });

    test('guards direct hidden create and select invocations before discovery or pickers', async () => {
        const created = await create.invoke(options({ resourcePath, packageList: ['numpy'] }), tokenSource.token);
        const selected = await select.invoke(
            options({ resourcePath, reason: 'cancelled' as const }),
            tokenSource.token,
        );

        expect(text(created)).to.include('configure_python_environment');
        expect(text(selected)).to.include('configure_python_environment');
        expect(await create.prepareInvocation({ input: { resourcePath } }, tokenSource.token)).to.deep.equal({});
        expect(await select.prepareInvocation({ input: { resourcePath } }, tokenSource.token)).to.deep.equal({});
        expect(await create.shouldCreateNewVirtualEnv(Uri.file(resourcePath), tokenSource.token)).to.equal(false);
        sinon.assert.called(getProvider);
        sinon.assert.notCalled(configureEnvironment);
        sinon.assert.notCalled(getEnvironment);
        sinon.assert.notCalled(installPackages);
    });

    test('does not claim success when a provider omits required environment details', () => {
        const incomplete: PythonToolResult = {
            status: 'success',
            environment: { ...returnedEnvironment, version: '' },
            created: true,
        };

        const result = utils.getPythonToolResponse(incomplete, 'Configured successfully');

        expect(text(result)).to.include('incomplete environment details');
        expect(text(result)).not.to.include('Configured successfully').and.not.to.include('was created');
    });

    test('never invents a generic python command for missing execution information', () => {
        const incomplete = ({
            status: 'success',
            environment: { ...returnedEnvironment, execInfo: undefined },
        } as unknown) as PythonToolResult;

        const result = utils.getPythonToolResponse(incomplete, 'Configured successfully');

        expect(text(result)).to.include('no executable command is available');
        expect(text(result)).not.to.include('Configured successfully');
    });

    test('does not fall back to run when an activatedRun command is malformed', () => {
        const incomplete = ({
            status: 'success',
            environment: {
                ...returnedEnvironment,
                execInfo: { ...returnedEnvironment.execInfo, activatedRun: {} },
            },
        } as unknown) as PythonToolResult;

        expect(text(utils.getPythonToolResponse(incomplete))).to.include('no executable command');
    });

    test('does not report a relative executable as an absolute Python command', () => {
        const result: PythonToolResult = {
            status: 'success',
            environment: { ...returnedEnvironment, execInfo: { run: { executable: 'python' } } },
        };

        expect(text(utils.getPythonToolResponse(result))).to.include('no executable command');
    });

    test('rejects malformed success results without an environment', () => {
        const result = utils.getPythonToolResponse(
            ({ status: 'success' } as unknown) as PythonToolResult,
            'Configured successfully',
        );

        expect(text(result)).to.include('did not return an environment').and.not.include('Configured successfully');
    });
});

suite('Legacy Python tool routing remains unchanged', () => {
    let tokenSource: CancellationTokenSource;
    let providerLookup: sinon.SinonStub;
    let api: PythonExtension['environments'];
    let container: IServiceContainer;
    let discovery: IDiscoveryAPI;
    let activePath: sinon.SinonStub;
    let resolveEnvironment: sinon.SinonStub;
    let installModule: sinon.SinonStub;
    let create: CreateVirtualEnvTool;
    let configure: ConfigurePythonEnvTool;
    const legacyEnvironment = ({
        id: 'legacy-env',
        path: pythonPath,
        executable: { uri: Uri.file(pythonPath), sysPrefix: environmentPath.fsPath },
        version: { major: 3, minor: 12, micro: 7, sysVersion: '3.12.7' },
        environment: { type: 'VirtualEnvironment' },
    } as unknown) as ResolvedEnvironment;

    setup(() => {
        tokenSource = new CancellationTokenSource();
        sinon.stub(envExtApi, 'useEnvExtension').returns(false);
        providerLookup = sinon.stub(envExtApi, 'getPythonToolsApi').throws(new Error('Unexpected private provider'));
        when(mockedVSCodeNamespaces.workspace!.notebookDocuments).thenReturn([]);
        when(mockedVSCodeNamespaces.workspace!.isTrusted).thenReturn(true);
        when(mockedVSCodeNamespaces.workspace!.workspaceFolders).thenReturn([]);
        sinon.stub(workspaceApis, 'getWorkspaceFolders').returns([]);
        activePath = sinon.stub().returns({ path: pythonPath, id: 'legacy-env' });
        resolveEnvironment = sinon.stub().resolves(legacyEnvironment);
        api = ({
            getActiveEnvironmentPath: activePath,
            resolveEnvironment,
        } as unknown) as PythonExtension['environments'];
        discovery = ({
            getEnvs: sinon.stub().returns([]),
            resolveEnv: sinon.stub().resolves(undefined),
        } as unknown) as IDiscoveryAPI;
        const services = mock<IServiceContainer>();
        when(services.get<ITerminalHelper>(ITerminalHelper)).thenReturn(({
            buildCommandForTerminal: TerminalHelper.prototype.buildCommandForTerminal,
        } as unknown) as ITerminalHelper);
        when(services.get<TerminalCodeExecutionProvider>(ICodeExecutionService, 'standard')).thenReturn(({
            getExecutableInfo: sinon.stub().resolves({ command: pythonPath, args: [] }),
        } as unknown) as TerminalCodeExecutionProvider);
        when(services.get<IRecommendedEnvironmentService>(IRecommendedEnvironmentService)).thenReturn(({
            getRecommededEnvironment: sinon.stub().resolves(undefined),
        } as unknown) as IRecommendedEnvironmentService);
        installModule = sinon.stub().resolves();
        when(services.getAll<IModuleInstaller>(IModuleInstaller)).thenReturn([
            ({
                type: ModuleInstallerType.Pip,
                isSupported: sinon.stub().returns(true),
                installModule,
            } as unknown) as IModuleInstaller,
        ]);
        container = instance(services);
        create = new CreateVirtualEnvTool(discovery, api, container);
        configure = new ConfigurePythonEnvTool(api, container, create);
    });

    teardown(() => {
        tokenSource.dispose();
        try {
            sinon.assert.notCalled(providerLookup);
        } finally {
            sinon.restore();
            reset(mockedVSCodeNamespaces.commands!);
            reset(mockedVSCodeNamespaces.lm!);
        }
    });

    test('gets executable details through the legacy active environment', async () => {
        const tool = new GetExecutableTool(api, container, discovery);

        const result = await tool.invoke(options({ resourcePath }), tokenSource.token);

        expect(text(result)).to.include('3.12.7').and.include(pythonPath.fileToCommandArgumentForPythonExt());
        sinon.assert.called(activePath);
        sinon.assert.called(resolveEnvironment);
    });

    test('gets packages through the legacy environment package query', async () => {
        const getPackages = sinon.stub(listPackages, 'getPythonPackagesResponse').resolves('- legacy-package (1.0)');
        const tool = new GetEnvironmentInfoTool(api, container);

        const result = await tool.invoke(options({ resourcePath }), tokenSource.token);

        expect(text(result)).to.include('legacy-package').and.include('3.12.7');
        sinon.assert.calledOnce(getPackages);
        expect(getPackages.firstCall.args[0]).to.equal(legacyEnvironment);
    });

    test('installs packages with the legacy installer and its existing process options', async () => {
        const tool = new InstallPackagesTool(api, container, discovery);

        const result = await tool.invoke(options({ resourcePath, packageList: ['requests'] }), tokenSource.token);

        expect(text(result)).to.include('Successfully installed package: requests');
        sinon.assert.calledOnceWithExactly(
            installModule,
            'requests',
            Uri.file(resourcePath),
            tokenSource.token,
            undefined,
            { installAsProcess: true, hideProgress: true },
        );
    });

    test('retains the nested create tool and its host approval workflow', async () => {
        sinon.stub(create, 'shouldCreateNewVirtualEnv').resolves(true);
        const invocation = options({ resourcePath });
        const expected = new LanguageModelToolResult([new LanguageModelTextPart('legacy create result')]);
        when(
            mockedVSCodeNamespaces.lm!.invokeTool(CreateVirtualEnvTool.toolName, invocation, tokenSource.token),
        ).thenCall(() => Promise.resolve(expected));

        expect(await configure.invoke(invocation, tokenSource.token)).to.equal(expected);
        verify(
            mockedVSCodeNamespaces.lm!.invokeTool(CreateVirtualEnvTool.toolName, invocation, tokenSource.token),
        ).once();
    });

    test('retains legacy cancelled-create fallback to the selection tool', async () => {
        sinon.stub(create, 'shouldCreateNewVirtualEnv').resolves(true);
        const invocation = options({ resourcePath });
        const expected = new LanguageModelToolResult([new LanguageModelTextPart('legacy select result')]);
        when(
            mockedVSCodeNamespaces.lm!.invokeTool(CreateVirtualEnvTool.toolName, invocation, tokenSource.token),
        ).thenCall(() => Promise.reject(new CancellationError()));
        const selected = sinon.stub().resolves(expected);
        when(
            mockedVSCodeNamespaces.lm!.invokeTool(SelectPythonEnvTool.toolName, anything(), tokenSource.token),
        ).thenCall(selected);

        expect(await configure.invoke(invocation, tokenSource.token)).to.equal(expected);
        sinon.assert.calledOnceWithExactly(
            selected,
            SelectPythonEnvTool.toolName,
            { ...invocation, input: { resourcePath, reason: 'cancelled' } },
            tokenSource.token,
        );
    });

    test('retains the legacy interpreter picker command for direct selection', async () => {
        sinon.stub(utils, 'doesWorkspaceHaveVenvOrCondaEnv').returns(undefined);
        const selection = sinon.stub().resolves({ path: pythonPath });
        when(mockedVSCodeNamespaces.commands!.executeCommand(Commands.Set_Interpreter, anything())).thenCall(selection);
        const tool = new SelectPythonEnvTool(api, container);

        const result = await tool.invoke(options({ resourcePath, reason: 'cancelled' as const }), tokenSource.token);

        expect(text(result)).to.include('has been configured').and.include('3.12.7');
        sinon.assert.calledOnceWithExactly(selection, Commands.Set_Interpreter, {
            hideCreateVenv: false,
            showBackButton: false,
        });
    });
});

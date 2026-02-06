// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { TestController, Uri } from 'vscode';

import { PYTEST_PROVIDER, UNITTEST_PROVIDER } from '../../../client/testing/common/constants';
import * as envExtApiInternal from '../../../client/envExt/api.internal';
import * as projectUtils from '../../../client/testing/testController/common/projectUtils';
import { PythonTestController } from '../../../client/testing/testController/controller';
import { TestProjectRegistry } from '../../../client/testing/testController/common/testProjectRegistry';

function createStubTestController(): TestController {
    const disposable = { dispose: () => undefined };

    const controller = ({
        items: {
            forEach: sinon.stub(),
            get: sinon.stub(),
            add: sinon.stub(),
            replace: sinon.stub(),
            delete: sinon.stub(),
            size: 0,
            [Symbol.iterator]: sinon.stub(),
        },
        createRunProfile: sinon.stub().returns(disposable),
        createTestItem: sinon.stub(),
        dispose: sinon.stub(),
        resolveHandler: undefined,
        refreshHandler: undefined,
    } as unknown) as TestController;

    return controller;
}

suite('PythonTestController', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    function createController(options?: { unittestEnabled?: boolean; interpreter?: any }): any {
        const unittestEnabled = options?.unittestEnabled ?? false;
        const interpreter =
            options?.interpreter ??
            ({
                displayName: 'Python 3.11',
                path: '/usr/bin/python3',
                version: { raw: '3.11.8' },
                sysPrefix: '/usr',
            } as any);

        const workspaceService = ({ workspaceFolders: [] } as unknown) as any;
        const configSettings = ({
            getSettings: sandbox.stub().returns({
                testing: {
                    unittestEnabled,
                    autoTestDiscoverOnSaveEnabled: false,
                },
            }),
        } as unknown) as any;

        const pytest = ({} as unknown) as any;
        const unittest = ({} as unknown) as any;
        const disposables: any[] = [];
        const interpreterService = ({
            getActiveInterpreter: sandbox.stub().resolves(interpreter),
        } as unknown) as any;

        const commandManager = ({
            registerCommand: sandbox.stub().returns({ dispose: () => undefined }),
        } as unknown) as any;
        const pythonExecFactory = ({} as unknown) as any;
        const debugLauncher = ({} as unknown) as any;
        const envVarsService = ({} as unknown) as any;

        return new PythonTestController(
            workspaceService,
            configSettings,
            pytest,
            unittest,
            disposables,
            interpreterService,
            commandManager,
            pythonExecFactory,
            debugLauncher,
            envVarsService,
        );
    }

    suite('getTestProvider', () => {
        test('returns unittest when enabled', () => {
            const controller = createController({ unittestEnabled: true });
            const workspaceUri: Uri = vscode.Uri.file('/workspace');

            const provider = (controller as any).getTestProvider(workspaceUri);

            assert.strictEqual(provider, UNITTEST_PROVIDER);
        });

        test('returns pytest when unittest not enabled', () => {
            const controller = createController({ unittestEnabled: false });
            const workspaceUri: Uri = vscode.Uri.file('/workspace');

            const provider = (controller as any).getTestProvider(workspaceUri);

            assert.strictEqual(provider, PYTEST_PROVIDER);
        });
    });

    suite('createDefaultProject (via TestProjectRegistry)', () => {
        test('creates a single default project using active interpreter', async () => {
            const workspaceUri: Uri = vscode.Uri.file('/workspace/myws');
            const interpreter = {
                displayName: 'My Python',
                path: '/opt/py/bin/python',
                version: { raw: '3.12.1' },
                sysPrefix: '/opt/py',
            };

            const fakeDiscoveryAdapter = { kind: 'discovery' };
            const fakeExecutionAdapter = { kind: 'execution' };
            sandbox.stub(projectUtils, 'createTestAdapters').returns({
                discoveryAdapter: fakeDiscoveryAdapter,
                executionAdapter: fakeExecutionAdapter,
            } as any);

            // Stub useEnvExtension to return false so createDefaultProject is called
            sandbox.stub(envExtApiInternal, 'useEnvExtension').returns(false);

            const interpreterService = {
                getActiveInterpreter: sandbox.stub().resolves(interpreter),
            } as any;

            const configSettings = {
                getSettings: sandbox.stub().returns({
                    testing: { unittestEnabled: false },
                }),
            } as any;

            const testController = createStubTestController();
            const envVarsService = {} as any;

            const registry = new TestProjectRegistry(
                testController,
                configSettings,
                interpreterService,
                envVarsService,
            );

            const projects = await registry.discoverAndRegisterProjects(workspaceUri);
            const project = projects[0];

            assert.strictEqual(projects.length, 1);
            assert.strictEqual(project.workspaceUri.toString(), workspaceUri.toString());
            assert.strictEqual(project.projectUri.toString(), workspaceUri.toString());
            assert.strictEqual(project.projectName, 'myws');

            assert.strictEqual(project.testProvider, PYTEST_PROVIDER);
            assert.strictEqual(project.discoveryAdapter, fakeDiscoveryAdapter);
            assert.strictEqual(project.executionAdapter, fakeExecutionAdapter);

            assert.strictEqual(project.pythonProject.uri.toString(), workspaceUri.toString());
            assert.strictEqual(project.pythonProject.name, 'myws');

            assert.strictEqual(project.pythonEnvironment.displayName, 'My Python');
            assert.strictEqual(project.pythonEnvironment.version, '3.12.1');
            assert.strictEqual(project.pythonEnvironment.execInfo.run.executable, '/opt/py/bin/python');
        });
    });

    suite('discoverWorkspaceProjects (via TestProjectRegistry)', () => {
        test('respects useEnvExtension() == false and falls back to single default project', async () => {
            const workspaceUri: Uri = vscode.Uri.file('/workspace/a');

            const useEnvExtensionStub = sandbox.stub(envExtApiInternal, 'useEnvExtension').returns(false);
            const getEnvExtApiStub = sandbox.stub(envExtApiInternal, 'getEnvExtApi');

            const fakeDiscoveryAdapter = { kind: 'discovery' };
            const fakeExecutionAdapter = { kind: 'execution' };
            sandbox.stub(projectUtils, 'createTestAdapters').returns({
                discoveryAdapter: fakeDiscoveryAdapter,
                executionAdapter: fakeExecutionAdapter,
            } as any);

            const interpreterService = {
                getActiveInterpreter: sandbox.stub().resolves({
                    displayName: 'Python 3.11',
                    path: '/usr/bin/python3',
                    version: { raw: '3.11.8' },
                    sysPrefix: '/usr',
                }),
            } as any;

            const configSettings = {
                getSettings: sandbox.stub().returns({
                    testing: { unittestEnabled: false },
                }),
            } as any;

            const testController = createStubTestController();
            const envVarsService = {} as any;

            const registry = new TestProjectRegistry(
                testController,
                configSettings,
                interpreterService,
                envVarsService,
            );

            const projects = await registry.discoverAndRegisterProjects(workspaceUri);

            assert.strictEqual(useEnvExtensionStub.called, true);
            assert.strictEqual(getEnvExtApiStub.notCalled, true);
            assert.strictEqual(projects.length, 1);
            assert.strictEqual(projects[0].projectUri.toString(), workspaceUri.toString());
        });

        test('filters Python projects to workspace and creates adapters for each', async () => {
            const workspaceUri: Uri = vscode.Uri.file('/workspace/root');

            const pythonProjects = [
                { name: 'p1', uri: vscode.Uri.file('/workspace/root/p1') },
                { name: 'p2', uri: vscode.Uri.file('/workspace/root/nested/p2') },
                { name: 'other', uri: vscode.Uri.file('/other/root/p3') },
            ];

            sandbox.stub(envExtApiInternal, 'useEnvExtension').returns(true);
            sandbox.stub(envExtApiInternal, 'getEnvExtApi').resolves({
                getPythonProjects: () => pythonProjects,
                getEnvironment: sandbox.stub().resolves({
                    name: 'env',
                    displayName: 'Python 3.11',
                    shortDisplayName: 'Python 3.11',
                    displayPath: '/usr/bin/python3',
                    version: '3.11.8',
                    environmentPath: vscode.Uri.file('/usr/bin/python3'),
                    sysPrefix: '/usr',
                    execInfo: { run: { executable: '/usr/bin/python3' } },
                    envId: { id: 'test', managerId: 'test' },
                }),
            } as any);

            const fakeDiscoveryAdapter = { kind: 'discovery' };
            const fakeExecutionAdapter = { kind: 'execution' };
            sandbox.stub(projectUtils, 'createTestAdapters').returns({
                discoveryAdapter: fakeDiscoveryAdapter,
                executionAdapter: fakeExecutionAdapter,
            } as any);

            const interpreterService = {
                getActiveInterpreter: sandbox.stub().resolves(null),
            } as any;

            const configSettings = {
                getSettings: sandbox.stub().returns({
                    testing: { unittestEnabled: false },
                }),
            } as any;

            const testController = createStubTestController();
            const envVarsService = {} as any;

            const registry = new TestProjectRegistry(
                testController,
                configSettings,
                interpreterService,
                envVarsService,
            );

            const projects = await registry.discoverAndRegisterProjects(workspaceUri);

            // Should only create adapters for the 2 projects in the workspace (not 'other')
            assert.strictEqual(projects.length, 2);
            const projectUris = projects.map((p: { projectUri: { fsPath: string } }) => p.projectUri.fsPath);
            const expectedInWorkspace = [
                vscode.Uri.file('/workspace/root/p1').fsPath,
                vscode.Uri.file('/workspace/root/nested/p2').fsPath,
            ];
            const expectedOutOfWorkspace = vscode.Uri.file('/other/root/p3').fsPath;

            expectedInWorkspace.forEach((expectedPath) => {
                assert.ok(projectUris.includes(expectedPath));
            });
            assert.ok(!projectUris.includes(expectedOutOfWorkspace));
        });

        test('falls back to default project when no projects are in the workspace', async () => {
            const workspaceUri: Uri = vscode.Uri.file('/workspace/root');

            sandbox.stub(envExtApiInternal, 'useEnvExtension').returns(true);
            sandbox.stub(envExtApiInternal, 'getEnvExtApi').resolves({
                getPythonProjects: () => [{ name: 'other', uri: vscode.Uri.file('/other/root/p3') }],
            } as any);

            const fakeDiscoveryAdapter = { kind: 'discovery' };
            const fakeExecutionAdapter = { kind: 'execution' };
            sandbox.stub(projectUtils, 'createTestAdapters').returns({
                discoveryAdapter: fakeDiscoveryAdapter,
                executionAdapter: fakeExecutionAdapter,
            } as any);

            const interpreter = {
                displayName: 'Python 3.11',
                path: '/usr/bin/python3',
                version: { raw: '3.11.8' },
                sysPrefix: '/usr',
            };

            const interpreterService = {
                getActiveInterpreter: sandbox.stub().resolves(interpreter),
            } as any;

            const configSettings = {
                getSettings: sandbox.stub().returns({
                    testing: { unittestEnabled: false },
                }),
            } as any;

            const testController = createStubTestController();
            const envVarsService = {} as any;

            const registry = new TestProjectRegistry(
                testController,
                configSettings,
                interpreterService,
                envVarsService,
            );

            const projects = await registry.discoverAndRegisterProjects(workspaceUri);

            // Should fall back to default project since no projects are in the workspace
            assert.strictEqual(projects.length, 1);
            assert.strictEqual(projects[0].projectUri.toString(), workspaceUri.toString());
        });
    });
});

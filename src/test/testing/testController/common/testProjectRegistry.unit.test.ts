// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { TestController, Uri } from 'vscode';
import { IConfigurationService } from '../../../../client/common/types';
import { IEnvironmentVariablesProvider } from '../../../../client/common/variables/types';
import { IInterpreterService } from '../../../../client/interpreter/contracts';
import { TestProjectRegistry } from '../../../../client/testing/testController/common/testProjectRegistry';
import * as envExtApiInternal from '../../../../client/envExt/api.internal';
import { PythonProject, PythonEnvironment } from '../../../../client/envExt/types';

suite('TestProjectRegistry', () => {
    let sandbox: sinon.SinonSandbox;
    let testController: TestController;
    let configSettings: IConfigurationService;
    let interpreterService: IInterpreterService;
    let envVarsService: IEnvironmentVariablesProvider;
    let registry: TestProjectRegistry;

    setup(() => {
        sandbox = sinon.createSandbox();

        // Create mock test controller
        testController = ({
            items: {
                get: sandbox.stub(),
                add: sandbox.stub(),
                delete: sandbox.stub(),
                forEach: sandbox.stub(),
            },
            createTestItem: sandbox.stub(),
            dispose: sandbox.stub(),
        } as unknown) as TestController;

        // Create mock config settings
        configSettings = ({
            getSettings: sandbox.stub().returns({
                testing: {
                    pytestEnabled: true,
                    unittestEnabled: false,
                },
            }),
        } as unknown) as IConfigurationService;

        // Create mock interpreter service
        interpreterService = ({
            getActiveInterpreter: sandbox.stub().resolves({
                displayName: 'Python 3.11',
                path: '/usr/bin/python3',
                version: { raw: '3.11.8' },
                sysPrefix: '/usr',
            }),
        } as unknown) as IInterpreterService;

        // Create mock env vars service
        envVarsService = ({
            getEnvironmentVariables: sandbox.stub().resolves({}),
        } as unknown) as IEnvironmentVariablesProvider;

        registry = new TestProjectRegistry(testController, configSettings, interpreterService, envVarsService);
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('hasProjects', () => {
        test('should return false for uninitialized workspace', () => {
            const workspaceUri = Uri.file('/workspace');

            const result = registry.hasProjects(workspaceUri);

            expect(result).to.be.false;
        });

        test('should return true after projects are registered', async () => {
            const workspaceUri = Uri.file('/workspace');

            // Mock useEnvExtension to return false to use default project path
            sandbox.stub(envExtApiInternal, 'useEnvExtension').returns(false);

            await registry.discoverAndRegisterProjects(workspaceUri);

            const result = registry.hasProjects(workspaceUri);

            expect(result).to.be.true;
        });
    });

    suite('getProjectsArray', () => {
        test('should return empty array for uninitialized workspace', () => {
            const workspaceUri = Uri.file('/workspace');

            const result = registry.getProjectsArray(workspaceUri);

            expect(result).to.be.an('array').that.is.empty;
        });

        test('should return projects after registration', async () => {
            const workspaceUri = Uri.file('/workspace');

            // Mock useEnvExtension to return false to use default project path
            sandbox.stub(envExtApiInternal, 'useEnvExtension').returns(false);

            await registry.discoverAndRegisterProjects(workspaceUri);

            const result = registry.getProjectsArray(workspaceUri);

            expect(result).to.be.an('array').with.length(1);
            expect(result[0].projectUri.fsPath).to.equal(workspaceUri.fsPath);
        });
    });

    suite('discoverAndRegisterProjects', () => {
        test('should create default project when env extension not available', async () => {
            const workspaceUri = Uri.file('/workspace/myproject');

            sandbox.stub(envExtApiInternal, 'useEnvExtension').returns(false);

            const projects = await registry.discoverAndRegisterProjects(workspaceUri);

            expect(projects).to.have.length(1);
            expect(projects[0].projectUri.fsPath).to.equal(workspaceUri.fsPath);
            expect(projects[0].testProvider).to.equal('pytest');
        });

        test('should use unittest when configured', async () => {
            const workspaceUri = Uri.file('/workspace/myproject');

            (configSettings.getSettings as sinon.SinonStub).returns({
                testing: {
                    pytestEnabled: false,
                    unittestEnabled: true,
                },
            });

            sandbox.stub(envExtApiInternal, 'useEnvExtension').returns(false);

            const projects = await registry.discoverAndRegisterProjects(workspaceUri);

            expect(projects).to.have.length(1);
            expect(projects[0].testProvider).to.equal('unittest');
        });

        test('should discover projects from Python Environments API', async () => {
            const workspaceUri = Uri.file('/workspace');
            const projectUri = Uri.file('/workspace/project1');

            const mockPythonProject: PythonProject = {
                name: 'project1',
                uri: projectUri,
            };

            const mockPythonEnv: PythonEnvironment = {
                name: 'env1',
                displayName: 'Python 3.11',
                shortDisplayName: 'Python 3.11',
                displayPath: '/usr/bin/python3',
                version: '3.11.8',
                environmentPath: Uri.file('/usr/bin/python3'),
                sysPrefix: '/usr',
                execInfo: { run: { executable: '/usr/bin/python3' } },
                envId: { id: 'env1', managerId: 'manager1' },
            };

            sandbox.stub(envExtApiInternal, 'useEnvExtension').returns(true);
            sandbox.stub(envExtApiInternal, 'getEnvExtApi').resolves({
                getPythonProjects: () => [mockPythonProject],
                getEnvironment: sandbox.stub().resolves(mockPythonEnv),
            } as any);

            const projects = await registry.discoverAndRegisterProjects(workspaceUri);

            expect(projects).to.have.length(1);
            expect(projects[0].projectName).to.include('project1');
            expect(projects[0].pythonEnvironment).to.deep.equal(mockPythonEnv);
        });

        test('should filter projects to current workspace', async () => {
            const workspaceUri = Uri.file('/workspace1');
            const projectInWorkspace = Uri.file('/workspace1/project1');
            const projectOutsideWorkspace = Uri.file('/workspace2/project2');

            const mockProjects: PythonProject[] = [
                { name: 'project1', uri: projectInWorkspace },
                { name: 'project2', uri: projectOutsideWorkspace },
            ];

            const mockPythonEnv: PythonEnvironment = {
                name: 'env1',
                displayName: 'Python 3.11',
                shortDisplayName: 'Python 3.11',
                displayPath: '/usr/bin/python3',
                version: '3.11.8',
                environmentPath: Uri.file('/usr/bin/python3'),
                sysPrefix: '/usr',
                execInfo: { run: { executable: '/usr/bin/python3' } },
                envId: { id: 'env1', managerId: 'manager1' },
            };

            sandbox.stub(envExtApiInternal, 'useEnvExtension').returns(true);
            sandbox.stub(envExtApiInternal, 'getEnvExtApi').resolves({
                getPythonProjects: () => mockProjects,
                getEnvironment: sandbox.stub().resolves(mockPythonEnv),
            } as any);

            const projects = await registry.discoverAndRegisterProjects(workspaceUri);

            expect(projects).to.have.length(1);
            expect(projects[0].projectUri.fsPath).to.equal(projectInWorkspace.fsPath);
        });

        test('should fallback to default project when no projects found', async () => {
            const workspaceUri = Uri.file('/workspace');

            sandbox.stub(envExtApiInternal, 'useEnvExtension').returns(true);
            sandbox.stub(envExtApiInternal, 'getEnvExtApi').resolves({
                getPythonProjects: () => [],
            } as any);

            const projects = await registry.discoverAndRegisterProjects(workspaceUri);

            expect(projects).to.have.length(1);
            expect(projects[0].projectUri.fsPath).to.equal(workspaceUri.fsPath);
        });

        test('should fallback to default project on API error', async () => {
            const workspaceUri = Uri.file('/workspace');

            sandbox.stub(envExtApiInternal, 'useEnvExtension').returns(true);
            sandbox.stub(envExtApiInternal, 'getEnvExtApi').rejects(new Error('API error'));

            const projects = await registry.discoverAndRegisterProjects(workspaceUri);

            expect(projects).to.have.length(1);
            expect(projects[0].projectUri.fsPath).to.equal(workspaceUri.fsPath);
        });
    });

    suite('configureNestedProjectIgnores', () => {
        test('should not set ignores when no nested projects', async () => {
            const workspaceUri = Uri.file('/workspace');
            const projectUri = Uri.file('/workspace/project1');

            const mockPythonProject: PythonProject = {
                name: 'project1',
                uri: projectUri,
            };

            const mockPythonEnv: PythonEnvironment = {
                name: 'env1',
                displayName: 'Python 3.11',
                shortDisplayName: 'Python 3.11',
                displayPath: '/usr/bin/python3',
                version: '3.11.8',
                environmentPath: Uri.file('/usr/bin/python3'),
                sysPrefix: '/usr',
                execInfo: { run: { executable: '/usr/bin/python3' } },
                envId: { id: 'env1', managerId: 'manager1' },
            };

            sandbox.stub(envExtApiInternal, 'useEnvExtension').returns(true);
            sandbox.stub(envExtApiInternal, 'getEnvExtApi').resolves({
                getPythonProjects: () => [mockPythonProject],
                getEnvironment: sandbox.stub().resolves(mockPythonEnv),
            } as any);

            await registry.discoverAndRegisterProjects(workspaceUri);
            registry.configureNestedProjectIgnores(workspaceUri);

            const projects = registry.getProjectsArray(workspaceUri);
            expect(projects[0].nestedProjectPathsToIgnore).to.be.undefined;
        });

        test('should configure ignore paths for nested projects', async () => {
            const workspaceUri = Uri.file('/workspace');
            const parentProjectUri = Uri.file('/workspace/parent');
            const childProjectUri = Uri.file(path.join('/workspace/parent', 'child'));

            const mockProjects: PythonProject[] = [
                { name: 'parent', uri: parentProjectUri },
                { name: 'child', uri: childProjectUri },
            ];

            const mockPythonEnv: PythonEnvironment = {
                name: 'env1',
                displayName: 'Python 3.11',
                shortDisplayName: 'Python 3.11',
                displayPath: '/usr/bin/python3',
                version: '3.11.8',
                environmentPath: Uri.file('/usr/bin/python3'),
                sysPrefix: '/usr',
                execInfo: { run: { executable: '/usr/bin/python3' } },
                envId: { id: 'env1', managerId: 'manager1' },
            };

            sandbox.stub(envExtApiInternal, 'useEnvExtension').returns(true);
            sandbox.stub(envExtApiInternal, 'getEnvExtApi').resolves({
                getPythonProjects: () => mockProjects,
                getEnvironment: sandbox.stub().resolves(mockPythonEnv),
            } as any);

            await registry.discoverAndRegisterProjects(workspaceUri);
            registry.configureNestedProjectIgnores(workspaceUri);

            const projects = registry.getProjectsArray(workspaceUri);
            const parentProject = projects.find((p) => p.projectUri.fsPath === parentProjectUri.fsPath);

            expect(parentProject?.nestedProjectPathsToIgnore).to.include(childProjectUri.fsPath);
        });

        test('should not set child project as ignored for sibling projects', async () => {
            const workspaceUri = Uri.file('/workspace');
            const project1Uri = Uri.file('/workspace/project1');
            const project2Uri = Uri.file('/workspace/project2');

            const mockProjects: PythonProject[] = [
                { name: 'project1', uri: project1Uri },
                { name: 'project2', uri: project2Uri },
            ];

            const mockPythonEnv: PythonEnvironment = {
                name: 'env1',
                displayName: 'Python 3.11',
                shortDisplayName: 'Python 3.11',
                displayPath: '/usr/bin/python3',
                version: '3.11.8',
                environmentPath: Uri.file('/usr/bin/python3'),
                sysPrefix: '/usr',
                execInfo: { run: { executable: '/usr/bin/python3' } },
                envId: { id: 'env1', managerId: 'manager1' },
            };

            sandbox.stub(envExtApiInternal, 'useEnvExtension').returns(true);
            sandbox.stub(envExtApiInternal, 'getEnvExtApi').resolves({
                getPythonProjects: () => mockProjects,
                getEnvironment: sandbox.stub().resolves(mockPythonEnv),
            } as any);

            await registry.discoverAndRegisterProjects(workspaceUri);
            registry.configureNestedProjectIgnores(workspaceUri);

            const projects = registry.getProjectsArray(workspaceUri);
            projects.forEach((project) => {
                expect(project.nestedProjectPathsToIgnore).to.be.undefined;
            });
        });
    });

    suite('clearWorkspace', () => {
        test('should remove all projects for a workspace', async () => {
            const workspaceUri = Uri.file('/workspace');

            sandbox.stub(envExtApiInternal, 'useEnvExtension').returns(false);

            await registry.discoverAndRegisterProjects(workspaceUri);
            expect(registry.hasProjects(workspaceUri)).to.be.true;

            registry.clearWorkspace(workspaceUri);

            expect(registry.hasProjects(workspaceUri)).to.be.false;
            expect(registry.getProjectsArray(workspaceUri)).to.be.empty;
        });

        test('should not affect other workspaces', async () => {
            const workspace1Uri = Uri.file('/workspace1');
            const workspace2Uri = Uri.file('/workspace2');

            sandbox.stub(envExtApiInternal, 'useEnvExtension').returns(false);

            await registry.discoverAndRegisterProjects(workspace1Uri);
            await registry.discoverAndRegisterProjects(workspace2Uri);

            registry.clearWorkspace(workspace1Uri);

            expect(registry.hasProjects(workspace1Uri)).to.be.false;
            expect(registry.hasProjects(workspace2Uri)).to.be.true;
        });
    });

    suite('getWorkspaceProjects', () => {
        test('should return undefined for uninitialized workspace', () => {
            const workspaceUri = Uri.file('/workspace');

            const result = registry.getWorkspaceProjects(workspaceUri);

            expect(result).to.be.undefined;
        });

        test('should return map after registration', async () => {
            const workspaceUri = Uri.file('/workspace');

            sandbox.stub(envExtApiInternal, 'useEnvExtension').returns(false);

            await registry.discoverAndRegisterProjects(workspaceUri);

            const result = registry.getWorkspaceProjects(workspaceUri);

            expect(result).to.be.instanceOf(Map);
            expect(result?.size).to.equal(1);
        });
    });

    suite('ProjectAdapter properties', () => {
        test('should create adapter with correct test infrastructure', async () => {
            const workspaceUri = Uri.file('/workspace/myproject');

            sandbox.stub(envExtApiInternal, 'useEnvExtension').returns(false);

            const projects = await registry.discoverAndRegisterProjects(workspaceUri);
            const project = projects[0];

            expect(project.projectName).to.be.a('string');
            expect(project.projectUri.fsPath).to.equal(workspaceUri.fsPath);
            expect(project.workspaceUri.fsPath).to.equal(workspaceUri.fsPath);
            expect(project.testProvider).to.equal('pytest');
            expect(project.discoveryAdapter).to.exist;
            expect(project.executionAdapter).to.exist;
            expect(project.resultResolver).to.exist;
            expect(project.isDiscovering).to.be.false;
            expect(project.isExecuting).to.be.false;
        });

        test('should include python environment details', async () => {
            const workspaceUri = Uri.file('/workspace/myproject');

            sandbox.stub(envExtApiInternal, 'useEnvExtension').returns(false);

            const projects = await registry.discoverAndRegisterProjects(workspaceUri);
            const project = projects[0];

            expect(project.pythonEnvironment).to.exist;
            expect(project.pythonProject).to.exist;
            expect(project.pythonProject.name).to.equal('myproject');
        });
    });
});

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { expect } from 'chai';
import * as assert from 'assert';
import { EOL } from 'os';
import * as path from 'path';
import { SemVer } from 'semver';
import * as sinon from 'sinon';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import { EventEmitter, Uri } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { WorkspaceService } from '../../../client/common/application/workspace';
import { PlatformService } from '../../../client/common/platform/platformService';
import { IPlatformService } from '../../../client/common/platform/types';
import { CurrentProcess } from '../../../client/common/process/currentProcess';
import { ProcessService } from '../../../client/common/process/proc';
import { ProcessServiceFactory } from '../../../client/common/process/processFactory';
import { IProcessService, IProcessServiceFactory } from '../../../client/common/process/types';
import { TerminalHelper } from '../../../client/common/terminal/helper';
import { ITerminalHelper } from '../../../client/common/terminal/types';
import { ICurrentProcess, Resource } from '../../../client/common/types';
import { getNamesAndValues } from '../../../client/common/utils/enum';
import { Architecture, OSType } from '../../../client/common/utils/platform';
import { EnvironmentVariablesProvider } from '../../../client/common/variables/environmentVariablesProvider';
import { IEnvironmentVariablesProvider } from '../../../client/common/variables/types';
import { EXTENSION_ROOT_DIR } from '../../../client/constants';
import { EnvironmentActivationService } from '../../../client/interpreter/activation/service';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { InterpreterService } from '../../../client/interpreter/interpreterService';
import { EnvironmentType, PythonEnvironment } from '../../../client/pythonEnvironments/info';
import { getSearchPathEnvVarNames } from '../../../client/common/utils/exec';
import * as workspaceApis from '../../../client/common/vscodeApis/workspaceApis';
import * as externalDependencies from '../../../client/pythonEnvironments/common/externalDependencies';
import { Conda } from '../../../client/pythonEnvironments/common/environmentManagers/conda';
import * as pixi from '../../../client/pythonEnvironments/common/environmentManagers/pixi';

const getEnvironmentPrefix = 'e8b39361-0157-4923-80e1-22d70d46dee6';
const defaultShells = {
    [OSType.Windows]: 'cmd',
    [OSType.OSX]: 'bash',
    [OSType.Linux]: 'bash',
    [OSType.Unknown]: undefined,
};

suite('Interpreters Activation - Python Environment Variables', () => {
    let service: EnvironmentActivationService;
    let helper: ITerminalHelper;
    let platform: IPlatformService;
    let processServiceFactory: IProcessServiceFactory;
    let processService: IProcessService;
    let currentProcess: ICurrentProcess;
    let envVarsService: IEnvironmentVariablesProvider;
    let workspace: IWorkspaceService;
    let interpreterService: IInterpreterService;
    let onDidChangeEnvVariables: EventEmitter<Uri | undefined>;
    let onDidChangeInterpreter: EventEmitter<Resource>;
    let getRunPixiPythonCommand: sinon.SinonStub;
    const pythonInterpreter: PythonEnvironment = {
        path: '/foo/bar/python.exe',
        version: new SemVer('3.6.6-final'),
        sysVersion: '1.0.0.0',
        sysPrefix: 'Python',
        envType: EnvironmentType.Unknown,
        architecture: Architecture.x64,
    };

    setup(() => {
        getRunPixiPythonCommand = sinon.stub(pixi, 'getRunPixiPythonCommand').resolves(undefined);
    });

    teardown(() => {
        sinon.restore();
    });

    function initSetup(interpreter: PythonEnvironment | undefined) {
        helper = mock(TerminalHelper);
        platform = mock(PlatformService);
        processServiceFactory = mock(ProcessServiceFactory);
        processService = mock(ProcessService);
        currentProcess = mock(CurrentProcess);
        envVarsService = mock(EnvironmentVariablesProvider);
        interpreterService = mock(InterpreterService);
        workspace = mock(WorkspaceService);
        onDidChangeEnvVariables = new EventEmitter<Uri | undefined>();
        onDidChangeInterpreter = new EventEmitter<Resource>();
        when(envVarsService.onDidEnvironmentVariablesChange).thenReturn(onDidChangeEnvVariables.event);
        when(interpreterService.onDidChangeInterpreter).thenReturn(onDidChangeInterpreter.event);
        when(interpreterService.getActiveInterpreter(anything())).thenResolve(interpreter);
        service = new EnvironmentActivationService(
            instance(helper),
            instance(platform),
            instance(processServiceFactory),
            instance(currentProcess),
            instance(workspace),
            instance(interpreterService),
            instance(envVarsService),
        );
    }

    function title(resource?: Uri, interpreter?: PythonEnvironment) {
        return `${resource ? 'With a resource' : 'Without a resource'}${interpreter ? ' and an interpreter' : ''}`;
    }

    suite('Pixi environment variable collection', () => {
        const projectPath = path.join(EXTENSION_ROOT_DIR, 'project with spaces');
        const manifestPath = path.join(projectPath, 'pixi.toml');
        const pixiExecutable = path.join(EXTENSION_ROOT_DIR, 'pixi tools', 'pixi.exe');
        const resource = Uri.file(path.join(EXTENSION_ROOT_DIR, 'other workspace', 'notebook.ipynb'));
        const envTypes = [EnvironmentType.Pixi, EnvironmentType.System, EnvironmentType.Unknown];

        setup(() => {
            initSetup(undefined);
            when(platform.osType).thenReturn(OSType.Windows);
            when(processServiceFactory.create(resource)).thenResolve(instance(processService));
            when(envVarsService.getEnvironmentVariables(resource)).thenResolve({});
            when(currentProcess.env).thenReturn({ INHERITED: 'preserved' });
        });

        for (const envType of envTypes) {
            for (const envName of ['default', 'analysis']) {
                for (const osType of [OSType.Windows, OSType.Linux, OSType.OSX]) {
                    test(`${envType}, ${envName}, ${osType}: runs Pixi without interactive activation`, async () => {
                        const prefix = path.join(projectPath, '.pixi', 'envs', envName);
                        const interpreter = {
                            ...pythonInterpreter,
                            path:
                                osType === OSType.Windows
                                    ? path.join(prefix, 'python.exe')
                                    : path.join(prefix, 'bin', 'python'),
                            envType,
                        };
                        const vars = {
                            CONDA_PREFIX: prefix,
                            PIXI_ENVIRONMENT_NAME: envName,
                            PYTHONWARNINGS: 'ignore',
                        };
                        when(platform.osType).thenReturn(osType);
                        when(processService.shellExec(anything(), anything())).thenResolve({
                            stdout: JSON.stringify(vars),
                        });
                        sinon.stub(externalDependencies, 'getPythonSetting').returns(pixiExecutable);
                        sinon
                            .stub(externalDependencies, 'pathExists')
                            .callsFake(async (candidate) => candidate === pixiExecutable);
                        sinon.stub(workspaceApis, 'getWorkspaceFolderPaths').returns([path.dirname(resource.fsPath)]);
                        const metadata = sinon.stub(pixi.Pixi.prototype, 'getPixiEnvironmentMetadata').resolves({
                            manifest_path: manifestPath,
                            pixi_version: '0.76.1',
                            environment_name: envName,
                        });
                        getRunPixiPythonCommand.resetBehavior();
                        getRunPixiPythonCommand.callThrough();

                        const env = await service.getActivatedEnvironmentVariables(resource, interpreter);

                        expect(env).to.deep.equal({ CONDA_PREFIX: prefix, PIXI_ENVIRONMENT_NAME: envName });
                        sinon.assert.calledOnceWithExactly(getRunPixiPythonCommand, interpreter.path);
                        sinon.assert.calledOnceWithExactly(metadata, prefix);
                        verify(
                            helper.getEnvironmentActivationShellCommands(anything(), anything(), anything()),
                        ).never();
                        const [command, options] = capture(processService.shellExec).first();
                        const expected = [
                            pixiExecutable,
                            'run',
                            '--manifest-path',
                            manifestPath,
                            ...(envName === 'default' ? [] : ['--environment', envName]),
                            'python',
                            path
                                .join(EXTENSION_ROOT_DIR, 'python_files', 'printEnvVariables.py')
                                .fileToCommandArgumentForPythonExt(),
                        ]
                            .map((arg) => arg.toCommandArgumentForPythonExt())
                            .join(' ');
                        expect(command).to.equal(expected);
                        expect(options).to.deep.equal({
                            env: { INHERITED: 'preserved', PYTHONWARNINGS: 'ignore' },
                            shell: defaultShells[osType],
                            timeout: 30000,
                            maxBuffer: 1000 * 1000,
                            throwOnStdErr: false,
                        });
                        expect(interpreter.envType).to.equal(envType);
                    });
                }
            }

            test(`${envType}: preserves fallback when no Pixi run command is available`, async () => {
                const interpreter = { ...pythonInterpreter, envType };
                when(helper.getEnvironmentActivationShellCommands(resource, anything(), interpreter)).thenResolve([
                    'activate-other',
                ]);
                when(processService.shellExec(anything(), anything())).thenResolve({ stdout: '{"RESULT":"ok"}' });

                const env = await service.getActivatedEnvironmentVariables(resource, interpreter);

                expect(env).to.deep.equal({ RESULT: 'ok' });
                sinon.assert.calledOnceWithExactly(getRunPixiPythonCommand, interpreter.path);
                verify(helper.getEnvironmentActivationShellCommands(resource, anything(), interpreter)).once();
                expect(capture(processService.shellExec).first()[0]).to.contain('activate-other &&');
            });
        }

        for (const envType of [
            EnvironmentType.Venv,
            EnvironmentType.Pyenv,
            EnvironmentType.Pipenv,
            EnvironmentType.Poetry,
        ]) {
            test(`${envType}: does not add Pixi detection to existing activation`, async () => {
                const interpreter = { ...pythonInterpreter, envType };
                when(helper.getEnvironmentActivationShellCommands(resource, anything(), interpreter)).thenResolve([
                    'activate-other',
                ]);
                when(processService.shellExec(anything(), anything())).thenResolve({ stdout: '{"RESULT":"ok"}' });

                expect(await service.getActivatedEnvironmentVariables(resource, interpreter)).to.deep.equal({
                    RESULT: 'ok',
                });
                sinon.assert.notCalled(getRunPixiPythonCommand);
                verify(helper.getEnvironmentActivationShellCommands(resource, anything(), interpreter)).once();
            });
        }

        test('preserves conda run and its timeout', async () => {
            const interpreter = { ...pythonInterpreter, envType: EnvironmentType.Conda };
            const conda = sinon.createStubInstance(Conda);
            conda.getRunPythonArgs.resolves(['conda', 'run', 'python']);
            sinon.stub(Conda, 'getConda').resolves(conda);
            when(processService.shellExec(anything(), anything())).thenResolve({ stdout: '{"RESULT":"ok"}' });

            expect(await service.getActivatedEnvironmentVariables(resource, interpreter)).to.deep.equal({
                RESULT: 'ok',
            });
            sinon.assert.notCalled(getRunPixiPythonCommand);
            verify(helper.getEnvironmentActivationShellCommands(anything(), anything(), anything())).never();
            const [command, options] = capture(processService.shellExec).first();
            expect(command).to.contain('conda run python ');
            expect(options?.timeout).to.equal(60000);
        });

        test('does not probe Pixi without an interpreter', async () => {
            await service.getActivatedEnvironmentVariables(resource);
            sinon.assert.notCalled(getRunPixiPythonCommand);
        });

        test('preserves requested exceptions when pixi run fails', async () => {
            const interpreter = { ...pythonInterpreter, envType: EnvironmentType.System };
            getRunPixiPythonCommand.resolves(['pixi', 'run', 'python']);
            const error = new Error('Pixi launch failed');
            when(processService.shellExec(anything(), anything())).thenReject(error);

            await assert.rejects(service.getActivatedEnvironmentVariables(resource, interpreter, true), error);
            verify(helper.getEnvironmentActivationShellCommands(anything(), anything(), anything())).never();
        });
    });

    [undefined, Uri.parse('a')].forEach((resource) =>
        [undefined, pythonInterpreter].forEach((interpreter) => {
            suite(title(resource, interpreter), () => {
                setup(() => initSetup(interpreter));
                test('Unknown os will return empty variables', async () => {
                    when(platform.osType).thenReturn(OSType.Unknown);
                    const env = await service.getActivatedEnvironmentVariables(resource);

                    verify(platform.osType).once();
                    expect(env).to.equal(undefined, 'Should not have any variables');
                });

                const osTypes = getNamesAndValues<OSType>(OSType).filter((osType) => osType.value !== OSType.Unknown);

                osTypes.forEach((osType) => {
                    suite(osType.name, () => {
                        setup(() => initSetup(interpreter));
                        test('getEnvironmentActivationShellCommands will be invoked', async () => {
                            when(platform.osType).thenReturn(osType.value);
                            when(
                                helper.getEnvironmentActivationShellCommands(resource, anything(), interpreter),
                            ).thenResolve();

                            const env = await service.getActivatedEnvironmentVariables(resource, interpreter);

                            verify(platform.osType).once();
                            expect(env).to.equal(undefined, 'Should not have any variables');
                            verify(
                                helper.getEnvironmentActivationShellCommands(resource, anything(), interpreter),
                            ).once();
                        });
                        test('Env variables returned for microvenv', async () => {
                            when(platform.osType).thenReturn(osType.value);

                            const microVenv = { ...pythonInterpreter, envType: EnvironmentType.Venv };
                            const key = getSearchPathEnvVarNames()[0];
                            const varsFromEnv = { [key]: '/foo/bar' };

                            when(
                                helper.getEnvironmentActivationShellCommands(resource, anything(), microVenv),
                            ).thenResolve();

                            const env = await service.getActivatedEnvironmentVariables(resource, microVenv);

                            verify(platform.osType).once();
                            expect(env).to.deep.equal(varsFromEnv);
                            verify(
                                helper.getEnvironmentActivationShellCommands(resource, anything(), microVenv),
                            ).once();
                        });
                        test('Validate command used to activation and printing env vars', async () => {
                            const cmd = ['1', '2'];
                            const envVars = { one: '1', two: '2' };
                            when(platform.osType).thenReturn(osType.value);
                            when(
                                helper.getEnvironmentActivationShellCommands(resource, anything(), interpreter),
                            ).thenResolve(cmd);
                            when(processServiceFactory.create(resource)).thenResolve(instance(processService));
                            when(envVarsService.getEnvironmentVariables(resource)).thenResolve(envVars);

                            const env = await service.getActivatedEnvironmentVariables(resource, interpreter);

                            verify(platform.osType).once();
                            expect(env).to.equal(undefined, 'Should not have any variables');
                            verify(
                                helper.getEnvironmentActivationShellCommands(resource, anything(), interpreter),
                            ).once();
                            verify(processServiceFactory.create(resource)).once();
                            verify(envVarsService.getEnvironmentVariables(resource)).once();
                            verify(processService.shellExec(anything(), anything())).once();

                            const shellCmd = capture(processService.shellExec).first()[0];

                            const printEnvPyFile = path.join(
                                EXTENSION_ROOT_DIR,
                                'python_files',
                                'printEnvVariables.py',
                            );
                            const expectedCommand = [
                                ...cmd,
                                `echo '${getEnvironmentPrefix}'`,
                                `python ${printEnvPyFile.fileToCommandArgumentForPythonExt()}`,
                            ].join(' && ');

                            expect(shellCmd).to.equal(expectedCommand);
                        });
                        test('Validate env Vars used to activation and printing env vars', async () => {
                            const cmd = ['1', '2'];
                            const envVars = { one: '1', two: '2' };
                            when(platform.osType).thenReturn(osType.value);
                            when(
                                helper.getEnvironmentActivationShellCommands(resource, anything(), interpreter),
                            ).thenResolve(cmd);
                            when(processServiceFactory.create(resource)).thenResolve(instance(processService));
                            when(envVarsService.getEnvironmentVariables(resource)).thenResolve(envVars);

                            const env = await service.getActivatedEnvironmentVariables(resource, interpreter);

                            verify(platform.osType).once();
                            expect(env).to.equal(undefined, 'Should not have any variables');
                            verify(
                                helper.getEnvironmentActivationShellCommands(resource, anything(), interpreter),
                            ).once();
                            verify(processServiceFactory.create(resource)).once();
                            verify(envVarsService.getEnvironmentVariables(resource)).once();
                            verify(processService.shellExec(anything(), anything())).once();

                            const options = capture(processService.shellExec).first()[1];

                            const expectedShell = defaultShells[osType.value];

                            expect(options).to.deep.equal({
                                shell: expectedShell,
                                env: envVars,
                                timeout: 30000,
                                maxBuffer: 1000 * 1000,
                                throwOnStdErr: false,
                            });
                        });
                        test('Use current process variables if there are no custom variables', async () => {
                            const cmd = ['1', '2'];
                            const envVars = { one: '1', two: '2', PYTHONWARNINGS: 'ignore' };
                            when(platform.osType).thenReturn(osType.value);
                            when(
                                helper.getEnvironmentActivationShellCommands(resource, anything(), interpreter),
                            ).thenResolve(cmd);
                            when(processServiceFactory.create(resource)).thenResolve(instance(processService));
                            when(envVarsService.getEnvironmentVariables(resource)).thenResolve({});
                            when(currentProcess.env).thenReturn(envVars);

                            const env = await service.getActivatedEnvironmentVariables(resource, interpreter);

                            verify(platform.osType).once();
                            expect(env).to.equal(undefined, 'Should not have any variables');
                            verify(
                                helper.getEnvironmentActivationShellCommands(resource, anything(), interpreter),
                            ).once();
                            verify(processServiceFactory.create(resource)).once();
                            verify(envVarsService.getEnvironmentVariables(resource)).once();
                            verify(processService.shellExec(anything(), anything())).once();
                            verify(currentProcess.env).once();

                            const options = capture(processService.shellExec).first()[1];

                            const expectedShell = defaultShells[osType.value];

                            expect(options).to.deep.equal({
                                env: envVars,
                                shell: expectedShell,
                                timeout: 30000,
                                maxBuffer: 1000 * 1000,
                                throwOnStdErr: false,
                            });
                        });
                        test('Error must be swallowed when activation fails', async () => {
                            const cmd = ['1', '2'];
                            const envVars = { one: '1', two: '2' };
                            when(platform.osType).thenReturn(osType.value);
                            when(
                                helper.getEnvironmentActivationShellCommands(resource, anything(), interpreter),
                            ).thenResolve(cmd);
                            when(processServiceFactory.create(resource)).thenResolve(instance(processService));
                            when(envVarsService.getEnvironmentVariables(resource)).thenResolve(envVars);
                            when(processService.shellExec(anything(), anything())).thenReject(new Error('kaboom'));

                            const env = await service.getActivatedEnvironmentVariables(resource, interpreter);

                            verify(platform.osType).once();
                            expect(env).to.equal(undefined, 'Should not have any variables');
                            verify(
                                helper.getEnvironmentActivationShellCommands(resource, anything(), interpreter),
                            ).once();
                            verify(processServiceFactory.create(resource)).once();
                            verify(envVarsService.getEnvironmentVariables(resource)).once();
                            verify(processService.shellExec(anything(), anything())).once();
                        });
                        test('Return parsed variables', async () => {
                            const cmd = ['1', '2'];
                            const envVars = { one: '1', two: '2' };
                            const varsFromEnv = { one: '11', two: '22', HELLO: 'xxx' };
                            const stdout = `${getEnvironmentPrefix}${EOL}${JSON.stringify(varsFromEnv)}`;
                            when(platform.osType).thenReturn(osType.value);
                            when(
                                helper.getEnvironmentActivationShellCommands(resource, anything(), interpreter),
                            ).thenResolve(cmd);
                            when(processServiceFactory.create(resource)).thenResolve(instance(processService));
                            when(envVarsService.getEnvironmentVariables(resource)).thenResolve(envVars);
                            when(processService.shellExec(anything(), anything())).thenResolve({ stdout: stdout });

                            const env = await service.getActivatedEnvironmentVariables(resource, interpreter);

                            verify(platform.osType).once();
                            expect(env).to.deep.equal(varsFromEnv);
                            verify(
                                helper.getEnvironmentActivationShellCommands(resource, anything(), interpreter),
                            ).once();
                            verify(processServiceFactory.create(resource)).once();
                            verify(envVarsService.getEnvironmentVariables(resource)).once();
                            verify(processService.shellExec(anything(), anything())).once();
                        });
                        test('Cache Variables', async () => {
                            const cmd = ['1', '2'];
                            const varsFromEnv = { one: '11', two: '22', HELLO: 'xxx' };
                            const stdout = `${getEnvironmentPrefix}${EOL}${JSON.stringify(varsFromEnv)}`;
                            when(platform.osType).thenReturn(osType.value);
                            when(
                                helper.getEnvironmentActivationShellCommands(resource, anything(), interpreter),
                            ).thenResolve(cmd);
                            when(processServiceFactory.create(resource)).thenResolve(instance(processService));
                            when(envVarsService.getEnvironmentVariables(resource)).thenResolve({});
                            when(processService.shellExec(anything(), anything())).thenResolve({ stdout: stdout });

                            const env = await service.getActivatedEnvironmentVariables(resource, interpreter);
                            const env2 = await service.getActivatedEnvironmentVariables(resource, interpreter);
                            const env3 = await service.getActivatedEnvironmentVariables(resource, interpreter);

                            expect(env).to.deep.equal(varsFromEnv);
                            // All same objects.
                            expect(env).to.equal(env2).to.equal(env3);

                            // All methods invoked only once.
                            verify(
                                helper.getEnvironmentActivationShellCommands(resource, anything(), interpreter),
                            ).once();
                            verify(processServiceFactory.create(resource)).once();
                            verify(envVarsService.getEnvironmentVariables(resource)).once();
                            verify(processService.shellExec(anything(), anything())).once();
                        });
                        async function testClearingCache(bustCache: Function) {
                            const cmd = ['1', '2'];
                            const varsFromEnv = { one: '11', two: '22', HELLO: 'xxx' };
                            const stdout = `${getEnvironmentPrefix}${EOL}${JSON.stringify(varsFromEnv)}`;
                            when(platform.osType).thenReturn(osType.value);
                            when(
                                helper.getEnvironmentActivationShellCommands(resource, anything(), interpreter),
                            ).thenResolve(cmd);
                            when(processServiceFactory.create(resource)).thenResolve(instance(processService));
                            when(envVarsService.getEnvironmentVariables(resource)).thenResolve({});
                            when(processService.shellExec(anything(), anything())).thenResolve({ stdout: stdout });

                            const env = await service.getActivatedEnvironmentVariables(resource, interpreter);
                            bustCache();
                            const env2 = await service.getActivatedEnvironmentVariables(resource, interpreter);

                            expect(env).to.deep.equal(varsFromEnv);
                            // Objects are different (not same reference).
                            expect(env).to.not.equal(env2);
                            // However variables are the same.
                            expect(env).to.deep.equal(env2);

                            // All methods invoked twice as cache was blown.
                            verify(
                                helper.getEnvironmentActivationShellCommands(resource, anything(), interpreter),
                            ).twice();
                            verify(processServiceFactory.create(resource)).twice();
                            verify(envVarsService.getEnvironmentVariables(resource)).twice();
                            verify(processService.shellExec(anything(), anything())).twice();
                        }
                        test('Cache Variables get cleared when changing env variables file', async () => {
                            await testClearingCache(onDidChangeEnvVariables.fire.bind(onDidChangeEnvVariables));
                        });
                    });
                });
            });
        }),
    );
});

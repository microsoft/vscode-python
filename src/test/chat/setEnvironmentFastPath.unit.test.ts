// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as sinon from 'sinon';
import {
    CancellationError,
    CancellationTokenSource,
    EventEmitter,
    LanguageModelToolInvocationOptions,
    Uri,
} from 'vscode';
import { instance, mock, when } from 'ts-mockito';
import { ConfigurePythonEnvTool, IConfigurePythonEnvToolArguments } from '../../client/chat/configurePythonEnvTool';
import { ISelectPythonEnvToolArguments, SelectPythonEnvTool } from '../../client/chat/selectEnvTool';
import { setEnvironmentDirectlyByPath, waitForActiveEnvironmentChange } from '../../client/chat/utils';
import { ActiveEnvironmentPathChangeEvent, PythonExtension, ResolvedEnvironment } from '../../client/api/types';
import { IServiceContainer } from '../../client/ioc/types';
import { ICodeExecutionService } from '../../client/terminals/types';
import { ITerminalHelper, TerminalShellType } from '../../client/common/terminal/types';
import { IRecommendedEnvironmentService } from '../../client/interpreter/configuration/types';
import { TerminalCodeExecutionProvider } from '../../client/terminals/codeExecution/terminalCodeExecution';
import { CreateVirtualEnvTool } from '../../client/chat/createVirtualEnvTool';
import { mockedVSCodeNamespaces } from '../vscode-mock';

suite('Chat fast-path environment setup', () => {
    const pythonPath = '/usr/bin/python3';
    const environment = ({
        id: 'python-env',
        path: pythonPath,
        executable: { uri: Uri.file(pythonPath), bitness: 64, sysPrefix: '/usr' },
        version: { major: 3, minor: 13, micro: 0, release: { level: 'final', serial: 0 }, sysVersion: '3.13.0' },
        environment: { type: 'Venv' },
    } as unknown) as ResolvedEnvironment;
    let tokenSource: CancellationTokenSource;

    function getToolResultText(content: readonly unknown[]): string {
        return content
            .map((part) =>
                typeof part === 'object' && part !== null && 'value' in part && typeof part.value === 'string'
                    ? part.value
                    : '',
            )
            .join(' ');
    }

    setup(() => {
        tokenSource = new CancellationTokenSource();
        when(mockedVSCodeNamespaces.workspace!.notebookDocuments).thenReturn([]);
        when(mockedVSCodeNamespaces.workspace!.isTrusted).thenReturn(true);
    });

    teardown(() => {
        tokenSource.dispose();
        sinon.restore();
    });

    suite('waitForActiveEnvironmentChange()', () => {
        function makeApi(emitter: EventEmitter<ActiveEnvironmentPathChangeEvent>) {
            return ({ onDidChangeActiveEnvironmentPath: emitter.event } as unknown) as PythonExtension['environments'];
        }

        test('resolves when an event matches the requested path', async () => {
            const emitter = new EventEmitter<ActiveEnvironmentPathChangeEvent>();
            const promise = waitForActiveEnvironmentChange(makeApi(emitter), pythonPath, undefined, tokenSource.token);
            let settled = false;
            void promise.then(() => {
                settled = true;
            });

            emitter.fire({ path: pythonPath, id: 'python-env', resource: undefined });
            await Promise.resolve();

            expect(settled).to.equal(true);
        });

        test('resolves when an event matches the requested environment id', async () => {
            const emitter = new EventEmitter<ActiveEnvironmentPathChangeEvent>();
            const promise = waitForActiveEnvironmentChange(makeApi(emitter), 'python-env', undefined, tokenSource.token);
            let settled = false;
            void promise.then(() => {
                settled = true;
            });

            emitter.fire({ path: pythonPath, id: 'python-env', resource: undefined });
            await Promise.resolve();

            expect(settled).to.equal(true);
        });

        test('resolves when an event matches an equivalent normalized path', async () => {
            const emitter = new EventEmitter<ActiveEnvironmentPathChangeEvent>();
            const promise = waitForActiveEnvironmentChange(makeApi(emitter), pythonPath, undefined, tokenSource.token);
            let settled = false;
            void promise.then(() => {
                settled = true;
            });

            emitter.fire({ path: '/usr/bin/../bin/python3', id: 'other-env', resource: undefined });
            await Promise.resolve();

            expect(settled).to.equal(true);
        });

        test('resolves on cancellation', async () => {
            const emitter = new EventEmitter<ActiveEnvironmentPathChangeEvent>();
            const promise = waitForActiveEnvironmentChange(
                makeApi(emitter),
                pythonPath,
                undefined,
                tokenSource.token,
                60_000,
            );
            let settled = false;
            void promise.then(() => {
                settled = true;
            });

            tokenSource.cancel();
            await Promise.resolve();

            expect(settled).to.equal(true);
        });

        test('ignores non-matching events', async () => {
            const emitter = new EventEmitter<ActiveEnvironmentPathChangeEvent>();
            const promise = waitForActiveEnvironmentChange(
                makeApi(emitter),
                pythonPath,
                undefined,
                tokenSource.token,
                60_000,
            );
            let settled = false;
            void promise.then(() => {
                settled = true;
            });

            emitter.fire({ path: '/other/python', id: 'other-env', resource: undefined });
            await Promise.resolve();

            expect(settled).to.equal(false);
            tokenSource.cancel();
            await promise;
        });

        test('ignores matching environment events for another workspace', async () => {
            const emitter = new EventEmitter<ActiveEnvironmentPathChangeEvent>();
            const resource = Uri.file('/workspace-one');
            const promise = waitForActiveEnvironmentChange(
                makeApi(emitter),
                pythonPath,
                resource,
                tokenSource.token,
                60_000,
            );
            let settled = false;
            void promise.then(() => {
                settled = true;
            });

            emitter.fire({ path: pythonPath, id: 'python-env', resource: Uri.file('/workspace-two') });
            await Promise.resolve();

            expect(settled).to.equal(false);
            emitter.fire({ path: pythonPath, id: 'python-env', resource });
            await promise;
        });
    });

    suite('setEnvironmentDirectlyByPath()', () => {
        test('validates before updating and returns the newly active environment', async () => {
            const emitter = new EventEmitter<ActiveEnvironmentPathChangeEvent>();
            const calls: string[] = [];
            let listenerAttached = false;
            let activePath = { path: '/old/python', id: 'old-env' };
            const api = ({
                onDidChangeActiveEnvironmentPath: (handler: (event: ActiveEnvironmentPathChangeEvent) => void) => {
                    listenerAttached = true;
                    return emitter.event(handler);
                },
                updateActiveEnvironmentPath: async (path: string) => {
                    expect(listenerAttached).to.equal(true);
                    calls.push(`update:${path}`);
                    activePath = { path, id: 'python-env' };
                    setImmediate(() => emitter.fire({ path, id: 'python-env', resource: undefined }));
                },
                getActiveEnvironmentPath: () => activePath,
                resolveEnvironment: async (value: string | { path: string }) => {
                    calls.push(`resolve:${typeof value === 'string' ? value : value.path}`);
                    return environment;
                },
            } as unknown) as PythonExtension['environments'];

            const result = await setEnvironmentDirectlyByPath(pythonPath, api, undefined, tokenSource.token);

            expect(result).to.equal(environment);
            expect(calls).to.deep.equal([`resolve:${pythonPath}`, `update:${pythonPath}`, `resolve:${pythonPath}`]);
        });

        test('does not update settings when the path cannot be resolved', async () => {
            const update = sinon.stub().resolves();
            const api = ({
                onDidChangeActiveEnvironmentPath: new EventEmitter<ActiveEnvironmentPathChangeEvent>().event,
                updateActiveEnvironmentPath: update,
                getActiveEnvironmentPath: () => ({ path: '/old/python', id: 'old-env' }),
                resolveEnvironment: sinon.stub().resolves(undefined),
            } as unknown) as PythonExtension['environments'];

            const result = await setEnvironmentDirectlyByPath('/invalid/python', api, undefined, tokenSource.token);

            expect(result).to.equal(undefined);
            sinon.assert.notCalled(update);
        });

        test('does not update settings when the requested environment is already active', async () => {
            const update = sinon.stub().resolves();
            const api = ({
                updateActiveEnvironmentPath: update,
                getActiveEnvironmentPath: () => ({ path: pythonPath, id: 'python-env' }),
                resolveEnvironment: sinon.stub().resolves(environment),
            } as unknown) as PythonExtension['environments'];

            const result = await setEnvironmentDirectlyByPath(pythonPath, api, undefined, tokenSource.token);

            expect(result).to.equal(environment);
            sinon.assert.notCalled(update);
        });

        test('does not report the previous environment when the active path fails to switch', async () => {
            const emitter = new EventEmitter<ActiveEnvironmentPathChangeEvent>();
            const resolveEnvironment = sinon.stub();
            resolveEnvironment.onFirstCall().resolves(environment);
            const api = ({
                onDidChangeActiveEnvironmentPath: emitter.event,
                updateActiveEnvironmentPath: async () => {
                    setImmediate(() =>
                        emitter.fire({ path: '/new/python', id: 'new-env', resource: undefined }),
                    );
                },
                getActiveEnvironmentPath: () => ({ path: '/old/python', id: 'old-env' }),
                resolveEnvironment,
            } as unknown) as PythonExtension['environments'];

            const result = await setEnvironmentDirectlyByPath(
                '/new/python',
                api,
                undefined,
                tokenSource.token,
            );

            expect(result).to.equal(undefined);
            sinon.assert.calledOnce(resolveEnvironment);
        });

        test('rejects immediately when already cancelled', async () => {
            const resolveEnvironment = sinon.stub().resolves(environment);
            const api = ({ resolveEnvironment } as unknown) as PythonExtension['environments'];
            tokenSource.cancel();

            let error: unknown;
            try {
                await setEnvironmentDirectlyByPath(pythonPath, api, undefined, tokenSource.token);
            } catch (ex) {
                error = ex;
            }

            expect(error).to.be.instanceOf(CancellationError);
            sinon.assert.notCalled(resolveEnvironment);
        });
    });

    test('configure tool skips interactive environment selection when pythonPath is provided', async () => {
        const resource = Uri.file('/workspace/file.py');
        const getRecommendedEnvironment = sinon.stub().resolves(undefined);
        const shouldCreateNewVirtualEnv = sinon.stub().resolves(false);
        const terminalExecutionService = mock<TerminalCodeExecutionProvider>();
        const terminalHelper = mock<ITerminalHelper>();
        when(terminalExecutionService.getExecutableInfo(resource)).thenResolve({
            command: 'python',
            args: [],
            python: ['python'],
            pythonExecutable: 'python',
        });
        when(terminalHelper.buildCommandForTerminal(TerminalShellType.other, 'python', [])).thenReturn('python');
        const serviceContainer = mock<IServiceContainer>();
        when(serviceContainer.get<TerminalCodeExecutionProvider>(ICodeExecutionService, 'standard')).thenReturn(
            instance(terminalExecutionService),
        );
        when(serviceContainer.get<ITerminalHelper>(ITerminalHelper)).thenReturn(instance(terminalHelper));
        when(serviceContainer.get<IRecommendedEnvironmentService>(IRecommendedEnvironmentService)).thenReturn(({
            getRecommededEnvironment: getRecommendedEnvironment,
        } as unknown) as IRecommendedEnvironmentService);
        const emitter = new EventEmitter<ActiveEnvironmentPathChangeEvent>();
        let activePath = { path: '/old/python', id: 'old-env' };
        const api = ({
            onDidChangeActiveEnvironmentPath: emitter.event,
            updateActiveEnvironmentPath: async (path: string) => {
                activePath = { path, id: 'python-env' };
                setImmediate(() => emitter.fire({ path, id: 'python-env', resource }));
            },
            getActiveEnvironmentPath: () => activePath,
            resolveEnvironment: sinon.stub().resolves(environment),
        } as unknown) as PythonExtension['environments'];
        const createVenvTool = ({ shouldCreateNewVirtualEnv } as unknown) as CreateVirtualEnvTool;
        const tool = new ConfigurePythonEnvTool(api, instance(serviceContainer), createVenvTool);
        const options = ({
            input: { pythonPath },
        } as unknown) as LanguageModelToolInvocationOptions<IConfigurePythonEnvToolArguments>;

        const result = await tool.invokeImpl(options, resource, tokenSource.token);

        const text = getToolResultText(result.content);
        expect(text).to.include('A Python Environment has been configured');
        sinon.assert.notCalled(getRecommendedEnvironment);
        sinon.assert.notCalled(shouldCreateNewVirtualEnv);
    });

    suite('SelectPythonEnvTool', () => {
        function createTool(api: PythonExtension['environments']) {
            const serviceContainer = mock<IServiceContainer>();
            when(serviceContainer.get<TerminalCodeExecutionProvider>(ICodeExecutionService, 'standard')).thenReturn(
                instance(mock<TerminalCodeExecutionProvider>()),
            );
            when(serviceContainer.get<ITerminalHelper>(ITerminalHelper)).thenReturn(instance(mock<ITerminalHelper>()));
            return new SelectPythonEnvTool(api, instance(serviceContainer));
        }

        test('returns the notebook response without changing the environment', async () => {
            const update = sinon.stub().resolves();
            const api = ({
                onDidChangeActiveEnvironmentPath: new EventEmitter<ActiveEnvironmentPathChangeEvent>().event,
                updateActiveEnvironmentPath: update,
            } as unknown) as PythonExtension['environments'];
            const tool = createTool(api);

            const result = await tool.invokeImpl(
                ({ input: { pythonPath } } as unknown) as LanguageModelToolInvocationOptions<
                    ISelectPythonEnvToolArguments
                >,
                Uri.file('/workspace/notebook.ipynb'),
                tokenSource.token,
            );

            const text = getToolResultText(result.content);
            expect(text.toLowerCase()).to.include('notebook');
            sinon.assert.notCalled(update);
        });

        test('skips confirmation when pythonPath is provided', async () => {
            const api = ({
                onDidChangeActiveEnvironmentPath: new EventEmitter<ActiveEnvironmentPathChangeEvent>().event,
            } as unknown) as PythonExtension['environments'];
            const tool = createTool(api);

            const preparation = await tool.prepareInvocationImpl(
                { input: { pythonPath } },
                Uri.file('/workspace/file.py'),
                tokenSource.token,
            );

            expect(preparation.confirmationMessages).to.equal(undefined);
        });
    });
});

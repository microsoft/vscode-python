// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as sinon from 'sinon';
import { CancellationTokenSource, EventEmitter, Uri } from 'vscode';
import { instance, mock, when } from 'ts-mockito';
import { mockedVSCodeNamespaces } from '../vscode-mock';
import { setEnvironmentDirectlyByPath, waitForActiveEnvironmentChange } from '../../client/chat/utils';
import { ConfigurePythonEnvTool } from '../../client/chat/configurePythonEnvTool';
import { SelectPythonEnvTool } from '../../client/chat/selectEnvTool';
import { PythonExtension } from '../../client/api/types';
import { IServiceContainer } from '../../client/ioc/types';
import { ICodeExecutionService } from '../../client/terminals/types';
import { ITerminalHelper } from '../../client/common/terminal/types';
import { IRecommendedEnvironmentService } from '../../client/interpreter/configuration/types';
import { TerminalCodeExecutionProvider } from '../../client/terminals/codeExecution/terminalCodeExecution';
import { CreateVirtualEnvTool } from '../../client/chat/createVirtualEnvTool';

suite('Chat fast-path environment setup', () => {
    let tokenSource: CancellationTokenSource;

    setup(() => {
        tokenSource = new CancellationTokenSource();
        when(mockedVSCodeNamespaces.workspace!.notebookDocuments).thenReturn([]);
    });

    teardown(() => {
        tokenSource.dispose();
        sinon.restore();
    });

    suite('waitForActiveEnvironmentChange()', () => {
        function makeApi(emitter: EventEmitter<{ path: string; id: string; resource: undefined }>) {
            return ({
                onDidChangeActiveEnvironmentPath: emitter.event,
            } as unknown) as PythonExtension['environments'];
        }

        test('resolves when an event matches the requested path', async () => {
            const emitter = new EventEmitter<{ path: string; id: string; resource: undefined }>();
            const api = makeApi(emitter);
            const promise = waitForActiveEnvironmentChange(api, '/usr/bin/python3', tokenSource.token, 5000);
            emitter.fire({ path: '/usr/bin/python3', id: 'id-1', resource: undefined });
            await promise;
        });

        test('resolves when an event matches the requested id', async () => {
            const emitter = new EventEmitter<{ path: string; id: string; resource: undefined }>();
            const api = makeApi(emitter);
            const promise = waitForActiveEnvironmentChange(api, 'env-id-42', tokenSource.token, 5000);
            emitter.fire({ path: '/some/other/path', id: 'env-id-42', resource: undefined });
            await promise;
        });

        test('resolves on cancellation without firing the event', async () => {
            const emitter = new EventEmitter<{ path: string; id: string; resource: undefined }>();
            const api = makeApi(emitter);
            const promise = waitForActiveEnvironmentChange(api, '/never/fires', tokenSource.token, 60_000);
            tokenSource.cancel();
            await promise;
        });

        test('resolves on timeout when the event never fires', async () => {
            const emitter = new EventEmitter<{ path: string; id: string; resource: undefined }>();
            const api = makeApi(emitter);
            await waitForActiveEnvironmentChange(api, '/never/fires', tokenSource.token, 5);
        });

        test('ignores events that do not match', async () => {
            const emitter = new EventEmitter<{ path: string; id: string; resource: undefined }>();
            const api = makeApi(emitter);
            const promise = waitForActiveEnvironmentChange(api, '/want/this', tokenSource.token, 50);
            emitter.fire({ path: '/something/else', id: 'wrong-id', resource: undefined });
            // Should fall through to the timeout rather than resolve from the non-matching event.
            await promise;
        });
    });

    suite('setEnvironmentDirectlyByPath()', () => {
        test('validates path, subscribes BEFORE update, then resolves the active env', async () => {
            const emitter = new EventEmitter<{ path: string; id: string; resource: undefined }>();
            let listenerAttached = false;
            const calls: string[] = [];
            const api = ({
                onDidChangeActiveEnvironmentPath: (handler: (e: any) => void) => {
                    listenerAttached = true;
                    return emitter.event(handler);
                },
                updateActiveEnvironmentPath: async (p: string) => {
                    calls.push(`update:${p}`);
                    expect(listenerAttached, 'listener must be attached before update').to.equal(true);
                    // Fire the event asynchronously, as the real API would.
                    setImmediate(() => emitter.fire({ path: p, id: p, resource: undefined }));
                },
                getActiveEnvironmentPath: () => ({ path: '/usr/bin/python3', id: 'id-1' }),
                resolveEnvironment: async (arg: any) => {
                    const key = typeof arg === 'string' ? arg : arg?.path;
                    calls.push(`resolve:${key}`);
                    // Validation call (string arg) must succeed so the rest of the sequence runs.
                    // Post-switch call (EnvironmentPath object) returns undefined to keep this test
                    // focused on sequencing without exercising getEnvDetailsForResponse internals.
                    if (typeof arg === 'string') {
                        return ({ id: 'x' } as unknown) as undefined;
                    }
                    return undefined;
                },
            } as unknown) as PythonExtension['environments'];

            const result = await setEnvironmentDirectlyByPath(
                '/usr/bin/python3',
                api,
                instance(mock<TerminalCodeExecutionProvider>()),
                instance(mock<ITerminalHelper>()),
                undefined,
                tokenSource.token,
            );

            expect(result).to.equal(undefined);
            expect(listenerAttached, 'listener must have been attached').to.equal(true);
            // Full sequence: validate (resolve) -> update -> resolve active env.
            expect(calls).to.deep.equal([
                'resolve:/usr/bin/python3',
                'update:/usr/bin/python3',
                'resolve:/usr/bin/python3',
            ]);
        });

        test('does NOT call updateActiveEnvironmentPath when pythonPath cannot be resolved', async () => {
            let updateCalled = false;
            const api = ({
                onDidChangeActiveEnvironmentPath: new EventEmitter<any>().event,
                updateActiveEnvironmentPath: async () => {
                    updateCalled = true;
                },
                getActiveEnvironmentPath: () => ({ path: '/old', id: 'old' }),
                resolveEnvironment: async () => undefined,
            } as unknown) as PythonExtension['environments'];

            const result = await setEnvironmentDirectlyByPath(
                '/bogus/python',
                api,
                instance(mock<TerminalCodeExecutionProvider>()),
                instance(mock<ITerminalHelper>()),
                undefined,
                tokenSource.token,
            );

            expect(result).to.equal(undefined);
            expect(updateCalled, 'must not mutate user settings for an invalid path').to.equal(false);
        });

        test('returns undefined when active path does not actually switch after update', async () => {
            const emitter = new EventEmitter<{ path: string; id: string; resource: undefined }>();
            let postSwitchResolveCalled = false;
            const api = ({
                onDidChangeActiveEnvironmentPath: emitter.event,
                updateActiveEnvironmentPath: async (p: string) => {
                    // Fire the change event so waitForActiveEnvironmentChange resolves normally
                    // (no cancellation, no timeout) -- this drives execution past the wait into
                    // the post-switch verification block.
                    setImmediate(() => emitter.fire({ path: p, id: p, resource: undefined }));
                },
                // But the getter still reports the OLD interpreter, simulating an inconsistent
                // switch where the event fired but the active path didn't actually update.
                getActiveEnvironmentPath: () => ({ path: '/previous', id: 'previous' }),
                resolveEnvironment: async (arg: any) => {
                    if (typeof arg === 'string') {
                        // Validation passes (path is known).
                        return ({ id: 'x' } as unknown) as undefined;
                    }
                    postSwitchResolveCalled = true;
                    return undefined;
                },
            } as unknown) as PythonExtension['environments'];

            const result = await setEnvironmentDirectlyByPath(
                '/new/python',
                api,
                instance(mock<TerminalCodeExecutionProvider>()),
                instance(mock<ITerminalHelper>()),
                undefined,
                tokenSource.token,
            );

            expect(result).to.equal(undefined);
            expect(postSwitchResolveCalled, 'must not resolve / report details for the previously-active env').to.equal(
                false,
            );
        });
    });

    suite('ConfigurePythonEnvTool fast path', () => {
        test('skips workspace-env / create-venv path when pythonPath is provided', async () => {
            const getRecommededEnvironment = sinon.stub().resolves(undefined);
            const shouldCreateNewVirtualEnv = sinon.stub().resolves(false);
            const serviceContainer = mock<IServiceContainer>();
            when(serviceContainer.get<TerminalCodeExecutionProvider>(ICodeExecutionService, 'standard')).thenReturn(
                instance(mock<TerminalCodeExecutionProvider>()),
            );
            when(serviceContainer.get<ITerminalHelper>(ITerminalHelper)).thenReturn(instance(mock<ITerminalHelper>()));
            when(serviceContainer.get<IRecommendedEnvironmentService>(IRecommendedEnvironmentService)).thenReturn(({
                getRecommededEnvironment,
            } as unknown) as IRecommendedEnvironmentService);

            const emitter = new EventEmitter<{ path: string; id: string; resource: undefined }>();
            let updateCalled = false;
            const api = ({
                onDidChangeActiveEnvironmentPath: emitter.event,
                updateActiveEnvironmentPath: async (p: string) => {
                    updateCalled = true;
                    setImmediate(() => emitter.fire({ path: p, id: p, resource: undefined }));
                },
                getActiveEnvironmentPath: () => ({ path: '/usr/bin/python3', id: 'id-1' }),
                // Validation (string arg) succeeds; post-switch resolve returns undefined
                // so the helper exits without exercising getEnvDetailsForResponse.
                resolveEnvironment: async (arg: any) =>
                    typeof arg === 'string' ? (({ id: 'x' } as unknown) as undefined) : undefined,
            } as unknown) as PythonExtension['environments'];

            const createVenvTool = ({ shouldCreateNewVirtualEnv } as unknown) as CreateVirtualEnvTool;
            const tool = new ConfigurePythonEnvTool(api, instance(serviceContainer), createVenvTool);

            try {
                await (tool as any).invokeImpl(
                    { input: { pythonPath: '/usr/bin/python3' } } as any,
                    Uri.file('/workspace/file.py'),
                    tokenSource.token,
                );
            } catch {
                // setEnvironmentDirectly throws when env can't be resolved; that's expected here.
                // The behavior we care about is that the fast path was taken.
            }

            expect(updateCalled, 'fast path should invoke updateActiveEnvironmentPath').to.equal(true);
            // The recommended-env / create-venv branches must not have been consulted.
            sinon.assert.notCalled(getRecommededEnvironment);
            sinon.assert.notCalled(shouldCreateNewVirtualEnv);
        });
    });

    suite('SelectPythonEnvTool', () => {
        test('returns notebook response without setting env when resource is a notebook', async () => {
            const serviceContainer = mock<IServiceContainer>();
            when(serviceContainer.get<TerminalCodeExecutionProvider>(ICodeExecutionService, 'standard')).thenReturn(
                instance(mock<TerminalCodeExecutionProvider>()),
            );
            when(serviceContainer.get<ITerminalHelper>(ITerminalHelper)).thenReturn(instance(mock<ITerminalHelper>()));

            let updateCalled = false;
            const api = ({
                onDidChangeActiveEnvironmentPath: new EventEmitter<any>().event,
                updateActiveEnvironmentPath: async () => {
                    updateCalled = true;
                },
                getActiveEnvironmentPath: () => ({ path: '/x', id: 'x' }),
                resolveEnvironment: async () => undefined,
            } as unknown) as PythonExtension['environments'];

            const tool = new SelectPythonEnvTool(api, instance(serviceContainer));

            const result = await (tool as any).invokeImpl(
                { input: { pythonPath: '/usr/bin/python3' } } as any,
                Uri.file('/workspace/notebook.ipynb'),
                tokenSource.token,
            );

            expect(updateCalled, 'must NOT update env for notebook resources').to.equal(false);
            expect(result, 'notebook resources must produce a tool response').to.not.equal(undefined);
            const text = (result.content as any[])
                .map((p) => (p && typeof p.value === 'string' ? p.value : ''))
                .join(' ');
            expect(text.toLowerCase()).to.include('notebook');
        });

        test('prepareInvocationImpl skips confirmation when pythonPath is provided', async () => {
            const serviceContainer = mock<IServiceContainer>();
            when(serviceContainer.get<TerminalCodeExecutionProvider>(ICodeExecutionService, 'standard')).thenReturn(
                instance(mock<TerminalCodeExecutionProvider>()),
            );
            when(serviceContainer.get<ITerminalHelper>(ITerminalHelper)).thenReturn(instance(mock<ITerminalHelper>()));

            const api = ({
                onDidChangeActiveEnvironmentPath: new EventEmitter<any>().event,
            } as unknown) as PythonExtension['environments'];
            const tool = new SelectPythonEnvTool(api, instance(serviceContainer));

            const prep = await (tool as any).prepareInvocationImpl(
                { input: { pythonPath: '/usr/bin/python3' } },
                Uri.file('/workspace/file.py'),
                tokenSource.token,
            );

            expect(prep.confirmationMessages, 'fast path must not show a confirmation prompt').to.equal(undefined);
        });
    });
});

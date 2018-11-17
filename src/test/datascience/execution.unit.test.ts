// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any

import { expect, assert } from 'chai';
import * as TypeMoq from 'typemoq';
import { should } from 'chai-as-promised';
import { anything, capture, instance, mock, when, spy } from 'ts-mockito';
import { CancellationToken, Disposable, Progress, ProgressOptions, EventEmitter } from 'vscode';
import { ServiceContainer } from '../../client/ioc/container';
import { IInterpreterService, PythonInterpreter, InterpreterType } from '../../client/interpreter/contracts';
import { InterpreterService } from '../../client/interpreter/interpreterService';
import { JupyterExecution } from '../../client/datascience/jupyterExecution';
import { PythonExecutionFactory } from '../../client/common/process/pythonExecutionFactory';
import { CondaService } from '../../client/interpreter/locators/services/condaService';
import { ProcessServiceFactory } from '../../client/common/process/processFactory';
import { ObservableExecutionResult, Output } from '../../client/common/process/types';

import { KnownSearchPathsForInterpreters } from '../../client/interpreter/locators/services/KnownPathsService';
import { Logger } from '../../client/common/logger';
import { FileSystem } from '../../client/common/platform/fileSystem';
import { Architecture } from '../../client/common/utils/platform';
import { PythonExecutionService } from '../../client/common/process/pythonProcess';
import { Matcher } from 'ts-mockito/lib/matcher/type/Matcher';
import { stub } from 'sinon';
import { ProcessService } from '../../client/common/process/proc';
import { BufferDecoder } from '../../client/common/process/decoder';
import { IProcessService, IPythonExecutionService, ExecutionResult } from '../../client/common/process/types';
import { Observable } from 'rxjs/Observable';

suite('Jupyter Execution', () => {
    const interpreterService = mock(InterpreterService);
    const executionFactory = mock(PythonExecutionFactory);
    const condaService = mock(CondaService);
    const processServiceFactory = mock(ProcessServiceFactory);
    const bufferDecoder = mock(BufferDecoder);
    const knownSearchPaths = mock(KnownSearchPathsForInterpreters);
    const logger = mock(Logger);
    const fileSystem = mock(FileSystem);
    const serviceContainer = mock(ServiceContainer);
    const disposableRegistry : Disposable[] = [];
    const dummyDisposable = {
        dispose: () => { return; }
    };
    const dummyEvent = new EventEmitter<void>();

    const workingPython: PythonInterpreter = {
        path: '/foo/bar/python.exe',
        version: '3.6.6.6',
        sysVersion: '1.0.0.0',
        sysPrefix: 'Python',
        type: InterpreterType.Unknown,
        architecture: Architecture.x64,
        version_info: [3, 6, 6, 'final']
    };

    setup(() => {
    });

    teardown(async () => {
        for (let i=0; i<disposableRegistry.length; i++) {
            const disposable = disposableRegistry[i];
            if (disposable) {
                const promise = disposable.dispose() as Promise<any>;
                if (promise) {
                    await promise;
                }
            }
        }
    });

    class FunctionMatcher extends Matcher {
        private func: (obj: any) => boolean;
        constructor(func: (obj: any) => boolean) {
            super();
            this.func = func;
        };
        public match(value: Object): boolean {
            return this.func(value);
        }
        public toString(): string
        {
            return 'FunctionMatcher';
        }
    }

    function argThat(func: (obj: any) => boolean) : any {
        return new FunctionMatcher(func);
    }

    function createTypeMoq<T>() : TypeMoq.IMock<T> {
        // Use typemoqs for those things that are resolved as promises. mockito doesn't allow nesting of mocks. ES6 Proxy class
        // is the problem. We still need to make it thenable though. See this issue: https://github.com/florinn/typemoq/issues/67
        const result = TypeMoq.Mock.ofType<T>();
        result.setup((x: any) => x.then).returns(() => undefined);
        return result;
    }

    function setupPythonService(service: TypeMoq.IMock<IPythonExecutionService>, module: string, args: string[], result: Promise<ExecutionResult<string>>) {
        service.setup(x => x.execModule(
            TypeMoq.It.isValue(module),
            TypeMoq.It.is(a => {
                if (a.length === args.length) {
                    return a.every((s, i) => s === args[i]);
                }
                return false;
            }),
            TypeMoq.It.isAny()))
            .returns(() => result);
    }

    function setupProcessServiceExec(service: TypeMoq.IMock<IProcessService>, file: string, args: string[], result: Promise<ExecutionResult<string>>) {
        service.setup(x => x.exec(
            TypeMoq.It.is(f => f.indexOf(file) >= 0),
            TypeMoq.It.is(a => {
                if (a.length === args.length) {
                    return a.every((s, i) => s === args[i]);
                }
                return false;
            }),
            TypeMoq.It.isAny()))
            .returns(() => result);
    }

    function setupProcessServiceExecObservable(service: TypeMoq.IMock<IProcessService>, file: string, args: string[], stderr: string[], stdout: string[]) {
        const result = {
            proc: undefined,
            out: new Observable<Output<string>>(subscriber => {
                stderr.forEach(s => subscriber.next({ source: 'stderr', out: s}));
                stdout.forEach(s => subscriber.next({ source: 'stderr', out: s}));
            })
        }

        service.setup(x => x.execObservable(
            TypeMoq.It.is(f => f.indexOf(file) >= 0),
            TypeMoq.It.is(a => {
                if (a.length === args.length) {
                    return a.every((s, i) => s === args[i]);
                }
                return false;
            }),
            TypeMoq.It.isAny()))
            .returns(() => result);
    }

    function logUnexpectedCall(func: string, v: any) {
        const message = `Unexpected call to ${func}(${v})`;
        console.log(message);
    }

    function setupWorkingPythonService(service: TypeMoq.IMock<IPythonExecutionService>) {
        setupPythonService(service, 'ipykernel', ['--version'], Promise.resolve({ stdout: '1.1.1.1'}));
        setupPythonService(service, 'jupyter', ['nbconvert', '--version'], Promise.resolve({ stdout: '1.1.1.1'}));
        setupPythonService(service, 'jupyter', ['notebook', '--version'], Promise.resolve({ stdout: '1.1.1.1'}));
        setupPythonService(service, 'jupyter', ['kernelspec', '--version'], Promise.resolve({ stdout: '1.1.1.1'}));

        // For any other call, log it and throw an exception
        service.setup(x => x.execModule(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((v) =>{
                logUnexpectedCall('IPythonExecutionService::execModule', v);
                return Promise.reject('Unexpected IPythonExecutionService call.')
            });

    }

    function setupWorkingProcessService(service: TypeMoq.IMock<IProcessService>) {
        // For any other call, log it and throw an exception
        service.setup(x => x.exec(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((v) =>{
                logUnexpectedCall('IProcessExecutionService::exec', v);
                return Promise.reject('Unexpected IProcessExecutionService call.')
            });
        service.setup(x => x.execObservable(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns((v) =>{
                logUnexpectedCall('IProcessExecutionService::execObservable', v);
                return undefined;
            });
    }

    function createExecution() : JupyterExecution {
        // Setup defaults
        when(interpreterService.onDidChangeInterpreter).thenReturn(dummyEvent.event);
        when(interpreterService.getActiveInterpreter()).thenResolve(workingPython);

        // Create our working python an dprocess service.
        const executionService = createTypeMoq<IPythonExecutionService>();
        setupWorkingPythonService(executionService);
        const processService = createTypeMoq<IProcessService>();
        setupWorkingProcessService(processService);
        when(executionFactory.create(argThat(o => o.pythonPath === workingPython.path))).thenResolve(executionService.object);
        when(processServiceFactory.create(anything())).thenResolve(processService.object);

        return new JupyterExecution(
            instance(executionFactory),
            instance(condaService),
            instance(interpreterService),
            instance(processServiceFactory),
            instance(knownSearchPaths),
            instance(logger),
            disposableRegistry,
            instance(fileSystem),
            instance(serviceContainer));
    }

    test('Working notebook and commands found', async () => {
        const execution = createExecution();
        await assert.eventually.equal(execution.isNotebookSupported(), true, 'Notebook not supported');
        await assert.eventually.equal(execution.isImportSupported(), true, 'Import not supported');
        await assert.eventually.equal(execution.isKernelSpecSupported(), true, 'Kernel Spec not supported');
        await assert.eventually.equal(execution.isKernelCreateSupported(), true, 'Kernel Create not supported');
        const usableInterpreter = await execution.getUsableJupyterPython();
        assert.isOk(usableInterpreter, 'Usable intepreter not found');
    });

    test('Failing notebook throws exception', async () => {
    });

    test('Failing others throws exception', async () => {
    });

    test('Other than active works', async () => {
    });

    test('Other than active finds closest match', async () => {
    });

    test('Kernelspec is deleted on exit', async () => {
    });

});

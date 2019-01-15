// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { nbformat } from '@jupyterlab/coreutils';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { Observable } from 'rxjs/Observable';
import * as TypeMoq from 'typemoq';
import * as uuid from 'uuid/v4';
import { EventEmitter } from 'vscode';
import { CancellationToken } from 'vscode-jsonrpc';

import { Cancellation } from '../../client/common/cancellation';
import { PythonSettings } from '../../client/common/configSettings';
import { ExecutionResult, IProcessServiceFactory, IPythonExecutionFactory, Output } from '../../client/common/process/types';
import { IAsyncDisposableRegistry, IConfigurationService } from '../../client/common/types';
import { EXTENSION_ROOT_DIR } from '../../client/constants';
import { generateCells } from '../../client/datascience/cellFactory';
import { concatMultilineString } from '../../client/datascience/common';
import { IConnection, IJupyterKernelSpec, IJupyterSession, IJupyterSessionManager } from '../../client/datascience/types';
import { IInterpreterService, PythonInterpreter } from '../../client/interpreter/contracts';
import { IServiceManager } from '../../client/ioc/types';
import { noop, sleep } from '../core';
import { MockJupyterSession } from './mockJupyterSession';
import { MockProcessService } from './mockProcessService';
import { MockPythonService } from './mockPythonService';

// tslint:disable:no-any no-http-string no-multiline-string max-func-body-length

const MockJupyterTimeDelay = 10;
const LineFeedRegEx = /(\r\n|\n)/g;

export enum SupportedCommands {
    none = 0,
    ipykernel = 1,
    nbconvert = 2,
    notebook = 4,
    kernelspec = 8,
    all = 0xFFFF
}

// This class is used to mock talking to jupyter. It mocks
// the process services, the interpreter services, the python services, and the jupyter session
export class MockJupyterManager implements IJupyterSessionManager {
    private pythonExecutionFactory = this.createTypeMoq<IPythonExecutionFactory>('Python Exec Factory');
    private processServiceFactory = this.createTypeMoq<IProcessServiceFactory>('Process Exec Factory');
    private processService: MockProcessService = new MockProcessService();
    private interpreterService = this.createTypeMoq<IInterpreterService>('Interpreter Service');
    private asyncRegistry : IAsyncDisposableRegistry;
    private changedInterpreterEvent: EventEmitter<void> = new EventEmitter<void>();
    private installedInterpreters : PythonInterpreter[] = [];
    private pythonServices: MockPythonService[] = [];
    private activeInterpreter: PythonInterpreter | undefined;
    private sessionTimeout: number | undefined;
    private cellDictionary = {};
    private kernelSpecs : {name: string; dir: string}[] = [];

    constructor(serviceManager: IServiceManager) {
        // Save async registry. Need to stick servers created into it
        this.asyncRegistry = serviceManager.get<IAsyncDisposableRegistry>(IAsyncDisposableRegistry);

        // Make our process service factory always return this item
        this.processServiceFactory.setup(p => p.create()).returns(() => Promise.resolve(this.processService));

        // Setup our interpreter service
        this.interpreterService.setup(i => i.onDidChangeInterpreter).returns(() => this.changedInterpreterEvent.event);
        this.interpreterService.setup(i => i.getActiveInterpreter()).returns(() => Promise.resolve(this.activeInterpreter));
        this.interpreterService.setup(i => i.getInterpreters()).returns(() => Promise.resolve(this.installedInterpreters));
        this.interpreterService.setup(i => i.getInterpreterDetails(TypeMoq.It.isAnyString())).returns((p) => {
            const found = this.installedInterpreters.find(i => i.path === p);
            if (found) {
                return Promise.resolve(found);
            }
            return Promise.reject('Unknown interpreter');
        });
        // Listen to configuration changes like the real interpreter service does so that we fire our settings changed event
        const configService = serviceManager.get<IConfigurationService>(IConfigurationService);
        if (configService && configService !== null) {
            (configService.getSettings() as PythonSettings).addListener('change', this.onConfigChanged);
        }

        // Stick our services into the service manager
        serviceManager.addSingletonInstance<IJupyterSessionManager>(IJupyterSessionManager, this);
        serviceManager.addSingletonInstance<IInterpreterService>(IInterpreterService, this.interpreterService.object);
        serviceManager.addSingletonInstance<IPythonExecutionFactory>(IPythonExecutionFactory, this.pythonExecutionFactory.object);
        serviceManager.addSingletonInstance<IProcessServiceFactory>(IProcessServiceFactory, this.processServiceFactory.object);

        // Setup our default kernel spec (this is just a dummy value)
        // tslint:disable-next-line:no-octal-literal
        this.kernelSpecs.push({name: '0e8519db-0895-416c-96df-fa80131ecea0', dir: 'C:\\Users\\rchiodo\\AppData\\Roaming\\jupyter\\kernels\\0e8519db-0895-416c-96df-fa80131ecea0'});

        // Setup our default cells that happen for everything
        this.addCell('%matplotlib inline\r\nimport matplotlib.pyplot as plt');
        this.addCell(`%cd "${path.join(EXTENSION_ROOT_DIR, 'src', 'test', 'datascience')}"`);
        this.addCell('import sys\r\nsys.version', '1.1.1.1');
        this.addCell('import sys\r\nsys.executable', 'python');
        this.addCell('import notebook\r\nnotebook.version_info', '1.1.1.1');
    }

    public makeActive(interpreter: PythonInterpreter) {
        this.activeInterpreter = interpreter;
    }

    public setProcessDelay(timeout: number | undefined) {
        this.processService.setDelay(timeout);
        this.pythonServices.forEach(p => p.setDelay(timeout));
    }

    public addInterpreter(interpreter: PythonInterpreter, supportedCommands: SupportedCommands, notebookStdErr?: string[]) {
        this.installedInterpreters.push(interpreter);

        // Add the python calls first.
        const pythonService = new MockPythonService(interpreter);
        this.pythonServices.push(pythonService);
        this.pythonExecutionFactory.setup(f => f.create(TypeMoq.It.is(o => {
            return o && o.pythonPath ? o.pythonPath === interpreter.path : false;
        }))).returns(() => Promise.resolve(pythonService));
        this.pythonExecutionFactory.setup(f => f.createActivatedEnvironment(TypeMoq.It.is(o => {
            return !o || JSON.stringify(o.interpreter) === JSON.stringify(interpreter);
        }))).returns(() => Promise.resolve(pythonService));
        this.setupSupportedPythonService(pythonService, interpreter, supportedCommands, notebookStdErr);

        // Then the process calls
        this.setupSupportedProcessService(interpreter, supportedCommands, notebookStdErr);

        // Default to being the new active
        this.makeActive(interpreter);
    }

    public addPath(jupyterPath: string, supportedCommands: SupportedCommands, notebookStdErr?: string[]) {
        this.setupPathProcessService(jupyterPath, this.processService, supportedCommands, notebookStdErr);
    }

    public addError(code: string, message: string) {
        // Turn the message into an nbformat.IError
        const result: nbformat.IError = {
            output_type: 'error',
            ename: message,
            evalue: message,
            traceback: []
        };

        this.addCell(code, result);
    }

    public addContinuousOutputCell(code: string, resultGenerator: (cancelToken: CancellationToken) => Promise<{result: string; haveMore: boolean}>) {
        const cells = generateCells(code, 'foo.py', 1, true);
        cells.forEach(c => {
            const key = concatMultilineString(c.data.source).replace(LineFeedRegEx, '');
            if (c.data.cell_type === 'code') {
                const taggedResult = {
                    output_type: 'generator'
                };
                const data: nbformat.ICodeCell = c.data as nbformat.ICodeCell;
                data.outputs = [...data.outputs, taggedResult];

                // Tag on our extra data
                taggedResult['resultGenerator'] = async (t) => {
                    const result = await resultGenerator(t);
                    return {
                        result: this.createStreamResult(result.result),
                        haveMore: result.haveMore
                    };
                };

                // Save in the cell.
                c.data = data;
            }

            // Save each in our dictionary for future use.
            // Note: Our entire setup is recreated each test so this dictionary
            // should be unique per test
            this.cellDictionary[key] = c;
        });
    }

    public addCell(code: string, result?: undefined | string | number | nbformat.IUnrecognizedOutput | nbformat.IExecuteResult | nbformat.IDisplayData | nbformat.IStream | nbformat.IError, mimeType?: string) {
        const cells = generateCells(code, 'foo.py', 1, true);
        cells.forEach(c => {
            const key = concatMultilineString(c.data.source).replace(LineFeedRegEx, '');
            if (c.data.cell_type === 'code') {
                const massagedResult = this.massageCellResult(result, mimeType);
                const data: nbformat.ICodeCell = c.data as nbformat.ICodeCell;
                data.outputs = [...data.outputs, massagedResult];
                c.data = data;
            }

            // Save each in our dictionary for future use.
            // Note: Our entire setup is recreated each test so this dictionary
            // should be unique per test
            this.cellDictionary[key] = c;
        });
    }

    public setWaitTime(timeout: number | undefined) {
        this.sessionTimeout = timeout;
    }

    public startNew(connInfo: IConnection, kernelSpec: IJupyterKernelSpec, cancelToken?: CancellationToken) : Promise<IJupyterSession> {
        this.asyncRegistry.push(connInfo);
        if (kernelSpec) {
            this.asyncRegistry.push(kernelSpec);
        }
        if (this.sessionTimeout && cancelToken) {
            const localTimeout = this.sessionTimeout;
            return Cancellation.race(async () => {
                await sleep(localTimeout);
                return new MockJupyterSession(this.cellDictionary, MockJupyterTimeDelay);
            }, cancelToken);
        } else {
            return Promise.resolve(new MockJupyterSession(this.cellDictionary, MockJupyterTimeDelay));
        }
    }

    public getActiveKernelSpecs(connection: IConnection) : Promise<IJupyterKernelSpec[]> {
        return Promise.resolve([]);
    }

    private onConfigChanged = () => {
        this.changedInterpreterEvent.fire();
    }

    private createStreamResult(str: string) : nbformat.IStream {
        return {
            output_type: 'stream',
            name: 'stdout',
            text: str
        };
    }

    private massageCellResult(
        result: undefined | string | number | nbformat.IUnrecognizedOutput | nbformat.IExecuteResult | nbformat.IDisplayData | nbformat.IStream | nbformat.IError,
        mimeType?: string) :
        nbformat.IUnrecognizedOutput | nbformat.IExecuteResult | nbformat.IDisplayData | nbformat.IStream | nbformat.IError {

        // See if undefined or string or number
        if (!result) {
            // This is an empty execute result
            return {
                output_type: 'execute_result',
                execution_count: 1,
                data: {},
                metadata : {}
            };
        } else if (typeof result === 'string') {
            const data = {};
            data[mimeType ? mimeType : 'text/plain'] = result;
            return {
                output_type: 'execute_result',
                execution_count: 1,
                data: data,
                metadata: {}
            };
        } else if (typeof result === 'number') {
            return {
                output_type: 'execute_result',
                execution_count: 1,
                data: { 'text/plain' : result.toString() },
                metadata : {}
            };
        } else {
            return result;
        }
    }

    private createTempSpec(pythonPath: string): string {
        const tempDir = os.tmpdir();
        const subDir = uuid();
        const filePath = path.join(tempDir, subDir, 'kernel.json');
        fs.ensureDirSync(path.dirname(filePath));
        fs.writeJSONSync(filePath,
            {
                display_name: 'Python 3',
                language: 'python',
                argv: [
                    pythonPath,
                    '-m',
                    'ipykernel_launcher',
                    '-f',
                    '{connection_file}'
                ]
            });
        return filePath;
    }

    private createTypeMoq<T>(tag: string): TypeMoq.IMock<T> {
        // Use typemoqs for those things that are resolved as promises. mockito doesn't allow nesting of mocks. ES6 Proxy class
        // is the problem. We still need to make it thenable though. See this issue: https://github.com/florinn/typemoq/issues/67
        const result = TypeMoq.Mock.ofType<T>();
        result['tag'] = tag;
        result.setup((x: any) => x.then).returns(() => undefined);
        return result;
    }

    private setupPythonServiceExec(service: MockPythonService, module: string, args: (string | RegExp)[], result: () => Promise<ExecutionResult<string>>) {
        service.addExecResult(['-m', module, ...args], result);
        service.addExecModuleResult(module, args, result);
    }

    private setupPythonServiceExecObservable(service: MockPythonService, module: string, args: (string | RegExp)[], stderr: string[], stdout: string[]) {
        const result = {
            proc: undefined,
            out: new Observable<Output<string>>(subscriber => {
                stderr.forEach(s => subscriber.next({ source: 'stderr', out: s }));
                stdout.forEach(s => subscriber.next({ source: 'stderr', out: s }));
            }),
            dispose: () => {
                noop();
            }
        };

        service.addExecObservableResult(['-m', module, ...args], () => result);
        service.addExecModuleObservableResult(module, args, () => result);
    }

    private setupProcessServiceExec(service: MockProcessService, file: string, args: (string | RegExp)[], result: () => Promise<ExecutionResult<string>>) {
        service.addExecResult(file, args, result);
    }

    private setupProcessServiceExecObservable(service: MockProcessService, file: string, args: (string | RegExp)[], stderr: string[], stdout: string[]) {
        service.addExecObservableResult(file, args, () => {
            return {
                proc: undefined,
                out: new Observable<Output<string>>(subscriber => {
                    stderr.forEach(s => subscriber.next({ source: 'stderr', out: s }));
                    stdout.forEach(s => subscriber.next({ source: 'stderr', out: s }));
                }),
                dispose: () => {
                    noop();
                }
            };
        });
    }

    private setupSupportedPythonService(service: MockPythonService, workingPython: PythonInterpreter, supportedCommands: SupportedCommands, notebookStdErr?: string[]) {
        if ((supportedCommands & SupportedCommands.ipykernel) === SupportedCommands.ipykernel) {
            this.setupPythonServiceExec(service, 'ipykernel', ['--version'], () => Promise.resolve({ stdout: '1.1.1.1' }));
            this.setupPythonServiceExec(service, 'ipykernel', ['install', '--user', '--name', /\w+-\w+-\w+-\w+-\w+/, '--display-name', `'Python Interactive'`], () => {
                const spec = this.addKernelSpec(workingPython.path);
                return Promise.resolve({ stdout: `somename ${path.dirname(spec)}` });
            });
        }
        if ((supportedCommands & SupportedCommands.nbconvert) === SupportedCommands.nbconvert) {
            this.setupPythonServiceExec(service, 'jupyter', ['nbconvert', '--version'], () => Promise.resolve({ stdout: '1.1.1.1' }));
            this.setupPythonServiceExec(service, 'jupyter', ['nbconvert', /.*/, '--to', 'python', '--stdout', '--template', /.*/], () => {
                return Promise.resolve({
                    stdout: '#%%\r\nimport os\r\nos.chdir()'
                });
            });
        }

        if ((supportedCommands & SupportedCommands.notebook) === SupportedCommands.notebook) {
            this.setupPythonServiceExec(service, 'jupyter', ['notebook', '--version'], () => Promise.resolve({ stdout: '1.1.1.1' }));
            this.setupPythonServiceExecObservable(service, 'jupyter', ['notebook', '--no-browser', /--notebook-dir=.*/, /.*/], [], notebookStdErr ? notebookStdErr : ['http://localhost:8888/?token=198']);
            this.setupPythonServiceExecObservable(service, 'jupyter', ['notebook', '--no-browser', /--notebook-dir=.*/], [], notebookStdErr ? notebookStdErr : ['http://localhost:8888/?token=198']);
        }
        if ((supportedCommands & SupportedCommands.kernelspec) === SupportedCommands.kernelspec) {
            this.setupPythonServiceExec(service, 'jupyter', ['kernelspec', '--version'], () => Promise.resolve({ stdout: '1.1.1.1' }));
            this.setupPythonServiceExec(service, 'jupyter', ['kernelspec', 'list'], () => {
                const results = this.kernelSpecs.map(k => {
                    return `  ${k.name}  ${k.dir}`;
                }).join(os.EOL);
                return Promise.resolve({stdout: results});
            });

        }
    }

    private addKernelSpec(pythonPath: string) : string {
        const spec = this.createTempSpec(pythonPath);
        this.kernelSpecs.push({name: `${this.kernelSpecs.length}Spec`, dir: `${path.dirname(spec)}`});
        return spec;
    }

    private setupSupportedProcessService(workingPython: PythonInterpreter, supportedCommands: SupportedCommands, notebookStdErr?: string[]) {
        if ((supportedCommands & SupportedCommands.ipykernel) === SupportedCommands.ipykernel) {
            // Don't mind the goofy path here. It's supposed to not find the item on your box. It's just testing the internal regex works
            this.setupProcessServiceExec(this.processService, workingPython.path, ['-m', 'jupyter', 'kernelspec', 'list'], () => {
                const results = this.kernelSpecs.map(k => {
                    return `  ${k.name}  ${k.dir}`;
                }).join(os.EOL);
                return Promise.resolve({stdout: results});
            });
            this.setupProcessServiceExec(this.processService, workingPython.path, ['-m', 'ipykernel', 'install', '--user', '--name', /\w+-\w+-\w+-\w+-\w+/, '--display-name', `'Python Interactive'`], () => {
                const spec = this.addKernelSpec(workingPython.path);
                return Promise.resolve({ stdout: `somename ${path.dirname(spec)}` });
            });
            const getServerInfoPath = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'datascience', 'getServerInfo.py');
            this.setupProcessServiceExec(this.processService, workingPython.path, [getServerInfoPath], () => Promise.resolve({ stdout: 'failure to get server infos' }));
            this.setupProcessServiceExecObservable(this.processService, workingPython.path, ['-m', 'jupyter', 'kernelspec', 'list'], [], []);
            this.setupProcessServiceExecObservable(this.processService, workingPython.path, ['-m', 'jupyter', 'notebook', '--no-browser', /--notebook-dir=.*/, /.*/], [], notebookStdErr ? notebookStdErr : ['http://localhost:8888/?token=198']);
            this.setupProcessServiceExecObservable(this.processService, workingPython.path, ['-m', 'jupyter', 'notebook', '--no-browser', /--notebook-dir=.*/], [], notebookStdErr ? notebookStdErr : ['http://localhost:8888/?token=198']);
        } else if ((supportedCommands & SupportedCommands.notebook) === SupportedCommands.notebook) {
            this.setupProcessServiceExec(this.processService, workingPython.path, ['-m', 'jupyter', 'kernelspec', 'list'], () => {
                const results = this.kernelSpecs.map(k => {
                    return `  ${k.name}  ${k.dir}`;
                }).join(os.EOL);
                return Promise.resolve({stdout: results});
            });
            const getServerInfoPath = path.join(EXTENSION_ROOT_DIR, 'pythonFiles', 'datascience', 'getServerInfo.py');
            this.setupProcessServiceExec(this.processService, workingPython.path, [getServerInfoPath], () => Promise.resolve({ stdout: 'failure to get server infos' }));
            this.setupProcessServiceExecObservable(this.processService, workingPython.path, ['-m', 'jupyter', 'kernelspec', 'list'], [], []);
            this.setupProcessServiceExecObservable(this.processService, workingPython.path, ['-m', 'jupyter', 'notebook', '--no-browser', /--notebook-dir=.*/, /.*/], [], notebookStdErr ? notebookStdErr : ['http://localhost:8888/?token=198']);
            this.setupProcessServiceExecObservable(this.processService, workingPython.path, ['-m', 'jupyter', 'notebook', '--no-browser', /--notebook-dir=.*/], [], notebookStdErr ? notebookStdErr : ['http://localhost:8888/?token=198']);
        }
        if ((supportedCommands & SupportedCommands.nbconvert) === SupportedCommands.nbconvert) {
            this.setupProcessServiceExec(this.processService, workingPython.path, ['-m', 'jupyter', 'nbconvert', /.*/, '--to', 'python', '--stdout', '--template', /.*/], () => {
                return Promise.resolve({
                    stdout: '#%%\r\nimport os\r\nos.chdir()'
                });
            });
        }
    }

    private setupPathProcessService(jupyterPath: string, service: MockProcessService, supportedCommands: SupportedCommands, notebookStdErr?: string[]) {
        if ((supportedCommands & SupportedCommands.kernelspec) === SupportedCommands.kernelspec) {
            this.setupProcessServiceExec(service, jupyterPath, ['kernelspec', 'list'], () => {
                const results = this.kernelSpecs.map(k => {
                    return `  ${k.name}  ${k.dir}`;
                }).join(os.EOL);
                return Promise.resolve({stdout: results});
            });
            this.setupProcessServiceExecObservable(service, jupyterPath, ['kernelspec', 'list'], [], []);
            this.setupProcessServiceExec(service, jupyterPath, ['kernelspec', '--version'], () =>  Promise.resolve({ stdout: '1.1.1.1' }));
            this.setupProcessServiceExec(service, 'jupyter', ['kernelspec', '--version'], () => Promise.resolve({ stdout: '1.1.1.1' }));
        } else {
            this.setupProcessServiceExec(service, jupyterPath, ['kernelspec', '--version'], () => Promise.reject());
            this.setupProcessServiceExec(service, 'jupyter', ['kernelspec', '--version'], () => Promise.reject());
        }

        this.setupProcessServiceExec(service, jupyterPath, ['--version'], () => Promise.resolve({ stdout: '1.1.1.1' }));
        this.setupProcessServiceExec(service, 'jupyter', ['--version'], () => Promise.resolve({ stdout: '1.1.1.1' }));

        if ((supportedCommands & SupportedCommands.kernelspec) === SupportedCommands.kernelspec) {
            this.setupProcessServiceExec(service, jupyterPath, ['notebook', '--version'], () => Promise.resolve({ stdout: '1.1.1.1' }));
            this.setupProcessServiceExecObservable(service, jupyterPath, ['notebook', '--no-browser', /--notebook-dir=.*/, /.*/], [], notebookStdErr ? notebookStdErr : ['http://localhost:8888/?token=198']);
            this.setupProcessServiceExec(service, 'jupyter', ['notebook', '--version'], () => Promise.resolve({ stdout: '1.1.1.1' }));
        } else {
            this.setupProcessServiceExec(service, 'jupyter', ['notebook', '--version'], () => Promise.reject());
            this.setupProcessServiceExec(service, jupyterPath, ['notebook', '--version'], () => Promise.reject());
        }
    }
}

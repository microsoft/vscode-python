// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as portfinder from 'portfinder';
import { promisify } from 'util';
import * as uuid from 'uuid/v4';
import { InterpreterUri } from '../../common/installer/types';
import { IPlatformService } from '../../common/platform/types';
import { IPythonExecutionFactory } from '../../common/process/types';
import { isResource } from '../../common/utils/misc';
import { IInterpreterService, PythonInterpreter } from '../../interpreter/contracts';
import { IJupyterKernelSpec } from '../types';
import { IKernelConnection, IKernelFinder, IKernelLauncher, IKernelProcess } from './types';

const windowsPaths = new Map([
    ['users', 'C:\\Users\\'],
    ['jupyter', '\\AppData\\Roaming\\jupyter\\kernels\\'],
    ['kernel', 'share\\jupyter\\kernels\\']
]);

const unixPaths = new Map([
    ['home', '/home/'],
    ['linuxJupyterPath', '/.local/share/jupyter/kernels/'],
    ['macJupyterPath', '/Library/Jupyter/kernels/'],
    ['kernel', 'share/jupyter/kernels/']
]);

const cachedPaths: Map<string, string> = new Map();

class KernelProcess implements IKernelProcess {
    private _process?: ChildProcess;
    private _connection?: IKernelConnection;
    public get process(): ChildProcess {
        return this._process!;
    }
    public get connection(): IKernelConnection {
        return this._connection!;
    }

    constructor(
        private interpreter: InterpreterUri,
        @inject(IPythonExecutionFactory) private executionFactory: IPythonExecutionFactory,
        private kernelSpec: IJupyterKernelSpec
    ) {}

    public async launch(): Promise<void> {
        const resource = isResource(this.interpreter) ? this.interpreter : undefined;
        const pythonPath = isResource(this.interpreter) ? undefined : this.interpreter.path;
        const args = this.kernelSpec.argv;
        args.splice(0, 1);

        const executionService = await this.executionFactory.create({ resource, pythonPath });
        const kernelProcess = executionService.execObservable(args, {});

        this._process = kernelProcess.proc;

        const getPorts = promisify(portfinder.getPorts);
        const ports = await getPorts(5, { host: '127.0.0.1', port: 9000 });

        this._connection = this.getKernelConnection(ports);
    }

    public dispose() {
        this._process?.kill();
    }

    private getKernelConnection(ports: number[]): IKernelConnection {
        return {
            version: 1,
            key: uuid(),
            signature_scheme: 'hmac-sha256',
            transport: 'tcp',
            ip: '127.0.0.1',
            hb_port: ports[0],
            control_port: ports[1],
            shell_port: ports[2],
            stdin_port: ports[3],
            iopub_port: ports[4]
        };
    }
}

class KernelFinder implements IKernelFinder {
    private exists = promisify(fs.exists);
    private readdir = promisify(fs.readdir);

    constructor(@inject(IPlatformService) private platformService: IPlatformService) {}

    public async findKernelSpec(
        kernelName: string,
        interpreterPaths: string[],
        currentInterpreter: PythonInterpreter | undefined
    ): Promise<IJupyterKernelSpec> {
        // Jupyter looks for kernels in these paths:
        // https://jupyter-client.readthedocs.io/en/stable/kernels.html#kernel-specs
        // So we do the same

        let spec: IJupyterKernelSpec | undefined;

        for (const entry of cachedPaths.entries()) {
            if (entry[1] === kernelName) {
                const kernelSpec = await fse.readJSON(entry[0]);
                return kernelSpec as IJupyterKernelSpec;
            }
        }

        for (const path1 of interpreterPaths) {
            spec = await this.getKernelSpec(path.join(path1, unixPaths.get('kernel')!), kernelName);

            if (spec) {
                return spec;
            }
        }

        if (this.platformService.isWindows) {
            // system paths
            spec = await this.getKernelSpec(path.join('C:\\ProgramData\\jupyter\\kernels\\'), kernelName);
            if (spec) {
                return spec;
            }

            // users paths
            const userPathExists = await this.exists(windowsPaths.get('users')!);
            if (userPathExists) {
                const users = await this.readdir(windowsPaths.get('users')!);
                for (const user of users) {
                    spec = await this.getKernelSpec(
                        path.join(windowsPaths.get('users')!, user, windowsPaths.get('jupyter')!),
                        kernelName
                    );

                    if (spec) {
                        return spec;
                    }
                }
            }
            // Unix based
        } else {
            // system paths
            spec = await this.getKernelSpec('/usr/share/jupyter/kernels', kernelName);
            if (spec) {
                return spec;
            }

            spec = await this.getKernelSpec('/usr/local/share/jupyter/kernels', kernelName);
            if (spec) {
                return spec;
            }

            // users paths
            const userPathExists = await this.exists(unixPaths.get('home')!);
            if (userPathExists) {
                const users = await this.readdir(unixPaths.get('home')!);
                for (const user of users) {
                    const secondPart = this.platformService.isMac
                        ? unixPaths.get('macJupyterPath')!
                        : unixPaths.get('linuxJupyterPath')!;
                    spec = await this.getKernelSpec(path.join(unixPaths.get('home')!, user, secondPart), kernelName);

                    if (spec) {
                        return spec;
                    }
                }
            }
        }

        return {
            name: currentInterpreter?.displayName ? currentInterpreter.displayName : 'Python',
            language: 'python',
            path: currentInterpreter?.path!,
            display_name: currentInterpreter?.displayName ? currentInterpreter.displayName : 'Python',
            metadata: {},
            argv: ['-m', 'ipykernel_launcher']
        };
    }

    public async getKernelSpec(kernelPath: string, kernelName: string): Promise<IJupyterKernelSpec | undefined> {
        const kernelJSON = '\\kernel.json';
        const pathExists = await this.exists(kernelPath);

        if (pathExists) {
            const kernels = await this.readdir(kernelPath);

            for (const kernel of kernels) {
                const kernelSpec = await fse.readJSON(path.join(kernelPath, kernel, kernelJSON));
                cachedPaths.set(path.join(kernelPath, kernel, kernelJSON), kernelSpec.display_name);

                if (kernelName === kernelSpec.name || kernelName === kernelSpec.display_name) {
                    return kernelSpec as IJupyterKernelSpec;
                }
            }
        }

        return undefined;
    }
}

@injectable()
export class KernelLauncher implements IKernelLauncher {
    constructor(
        @inject(IPythonExecutionFactory) private executionFactory: IPythonExecutionFactory,
        @inject(IInterpreterService) private interpreterService: IInterpreterService,
        @inject(IPlatformService) private platformService: IPlatformService
    ) {}

    public async launch(interpreterUri: InterpreterUri, kernelName: string): Promise<IKernelProcess> {
        const finder = new KernelFinder(this.platformService);
        const notebookInterpreter = isResource(interpreterUri) ? undefined : interpreterUri;
        const currentInterpreter = await this.interpreterService.getActiveInterpreter();
        let kernelSpec: IJupyterKernelSpec | undefined;

        // If the selecter interpreter and the notebook interpreter are the same,
        // or the name of the notebook interpreter is python 3,
        // we create the kernelspec from the selected interpreter
        if (
            currentInterpreter &&
            notebookInterpreter &&
            (notebookInterpreter.path === currentInterpreter.path ||
                (notebookInterpreter.displayName &&
                    notebookInterpreter.displayName.toLowerCase().indexOf('python 3') !== -1))
        ) {
            kernelSpec = await finder.getKernelSpec(
                path.join(currentInterpreter.path, unixPaths.get('kernel')!),
                kernelName
            );
        }

        if (!kernelSpec) {
            const interpreters = await this.interpreterService.getInterpreters();
            const interpreterPaths = interpreters.map(interp => interp.path);

            kernelSpec = await finder.findKernelSpec(kernelName, interpreterPaths, currentInterpreter);
        }

        const kernel = new KernelProcess(interpreterUri, this.executionFactory, kernelSpec);
        await kernel.launch();
        return kernel;
    }
}

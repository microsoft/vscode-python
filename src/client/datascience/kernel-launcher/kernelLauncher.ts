// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as portfinder from 'portfinder';
import { promisify } from 'util';
import * as uuid from 'uuid/v4';
import { InterpreterUri } from '../../common/installer/types';
import { PlatformService } from '../../common/platform/platformService';
import { IPythonExecutionFactory } from '../../common/process/types';
import { isResource } from '../../common/utils/misc';
import { IInterpreterService } from '../../interpreter/contracts';
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
        private kernelSpec: IJupyterKernelSpec | undefined
    ) {
        this.interpreter = interpreter;
        this.executionFactory = executionFactory;
    }

    public async launch(): Promise<void> {
        const resource = isResource(this.interpreter) ? this.interpreter : undefined;
        const pythonPath = isResource(this.interpreter) ? undefined : this.interpreter.path;
        const args = this.getArgs(this.kernelSpec);

        const executionService = await this.executionFactory.create({ resource, pythonPath });
        const kernelProcess = executionService.execObservable(args, {});

        this._process = kernelProcess.proc;

        const getPorts = promisify(portfinder.getPorts);
        const ports = await getPorts(5, { host: '127.0.0.1', port: 9000 });

        this._connection = this.getKernelConnection(ports);

        return Promise.resolve();
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

    private getArgs(kernelSpec: IJupyterKernelSpec | undefined): string[] {
        if (kernelSpec) {
            switch (kernelSpec.language) {
                case 'python':
                default:
                    return [kernelSpec.argv[1], kernelSpec.argv[2]];
            }
        }

        return ['-m', 'ipykernel_launcher'];
    }
}

class KernelFinder implements IKernelFinder {
    public findKernelSpec(kernelName: string, interpreterPaths: string[]): IJupyterKernelSpec | undefined {
        // Jupyter looks for kernels in these paths:
        // https://jupyter-client.readthedocs.io/en/stable/kernels.html#kernel-specs
        // So we do the same

        let spec: IJupyterKernelSpec | undefined;

        for (const entry of cachedPaths.entries()) {
            if (entry[1] === kernelName) {
                const kernelSpec = fse.readJSONSync(entry[0]);

                return {
                    name: kernelSpec.name,
                    language: kernelSpec.language,
                    path: kernelSpec.metadata?.interpreter?.path,
                    display_name: kernelSpec.display_name,
                    metadata: kernelSpec.metadata,
                    argv: kernelSpec.argv
                };
            }
        }

        const platform = new PlatformService();

        for (const path of interpreterPaths) {
            const index = path.lastIndexOf(platform.isWindows ? '\\' : '/');
            const fixedPath = path.substring(0, index + 1);
            const secondPart = platform.isWindows ? windowsPaths.get('kernel')! : unixPaths.get('kernel')!;
            spec = this.getKernelSpec(fixedPath + secondPart, kernelName);

            if (spec) {
                return spec;
            }
        }

        if (platform.isWindows) {
            // system paths
            spec = this.getKernelSpec('C:\\ProgramData\\jupyter\\kernels\\', kernelName);
            if (spec) {
                return spec;
            }

            // users paths
            if (fs.existsSync(windowsPaths.get('users')!)) {
                for (const user of fs.readdirSync(windowsPaths.get('users')!)) {
                    spec = this.getKernelSpec(
                        windowsPaths.get('users')! + user + windowsPaths.get('jupyter')!,
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
            spec = this.getKernelSpec('/usr/share/jupyter/kernels', kernelName);
            if (spec) {
                return spec;
            }

            spec = this.getKernelSpec('/usr/local/share/jupyter/kernels', kernelName);
            if (spec) {
                return spec;
            }

            // users paths
            if (fs.existsSync(unixPaths.get('home')!)) {
                for (const user of fs.readdirSync(unixPaths.get('home')!)) {
                    const secondPart = platform.isMac
                        ? unixPaths.get('macJupyterPath')!
                        : unixPaths.get('linuxJupyterPath')!;
                    spec = this.getKernelSpec(unixPaths.get('home')! + user + secondPart, kernelName);

                    if (spec) {
                        return spec;
                    }
                }
            }
        }

        return undefined;
    }

    public getKernelSpec(path: string, kernelName: string): IJupyterKernelSpec | undefined {
        const kernelJSON = '\\kernel.json';

        if (fs.existsSync(path)) {
            const kernels = fs.readdirSync(path);

            for (const kernel of kernels) {
                const kernelSpec = fse.readJSONSync(path + kernel + kernelJSON);
                cachedPaths.set(path + kernel + kernelJSON, kernelSpec.display_name);

                if (kernelName === kernelSpec.name || kernelName === kernelSpec.display_name) {
                    return {
                        name: kernelSpec.name,
                        language: kernelSpec.language,
                        path: kernelSpec.metadata?.interpreter?.path,
                        display_name: kernelSpec.display_name,
                        metadata: kernelSpec.metadata,
                        argv: kernelSpec.argv
                    };
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
        @inject(IInterpreterService) private interpreterService: IInterpreterService
    ) {}

    public async launch(interpreterUri: InterpreterUri, kernelName: string): Promise<IKernelProcess> {
        const finder = new KernelFinder();
        const pythonPath = isResource(interpreterUri) ? undefined : interpreterUri;
        const currentInterpreter = await this.interpreterService.getActiveInterpreter();
        let kernelSpec: IJupyterKernelSpec | undefined;

        if (
            currentInterpreter &&
            pythonPath &&
            (pythonPath.path === currentInterpreter.path ||
                (pythonPath.displayName && pythonPath.displayName.toLowerCase().indexOf('python 3') !== -1))
        ) {
            const platform = new PlatformService();

            const index = currentInterpreter.path.lastIndexOf(platform.isWindows ? '\\' : '/');
            const fixedPath = currentInterpreter.path.substring(0, index + 1);
            const secondPart = platform.isWindows ? windowsPaths.get('kernel')! : unixPaths.get('kernel')!;
            kernelSpec = finder.getKernelSpec(fixedPath + secondPart, kernelName);
        } else {
            const interpreters = await this.interpreterService.getInterpreters();

            const interpreterPaths: string[] = [];
            for (const interp of interpreters) {
                interpreterPaths.push(interp.path);
            }

            kernelSpec = finder.findKernelSpec(kernelName, interpreterPaths);
        }

        const kernel = new KernelProcess(interpreterUri, this.executionFactory, kernelSpec);
        await kernel.launch();
        return kernel;
    }
}

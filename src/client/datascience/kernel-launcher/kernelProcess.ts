// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { ChildProcess } from 'child_process';
import { inject, injectable } from 'inversify';
import * as os from 'os';
import * as path from 'path';
import * as portfinder from 'portfinder';
import { promisify } from 'util';
import * as uuid from 'uuid/v4';
import { InterpreterUri } from '../../common/installer/types';
import { IFileSystem } from '../../common/platform/types';
import { IPythonExecutionFactory } from '../../common/process/types';
import { isResource, noop } from '../../common/utils/misc';
import { IJupyterKernelSpec } from '../types';
import { IKernelConnection, IKernelProcess } from './types';

@injectable()
export class KernelProcess implements IKernelProcess {
    private _process?: ChildProcess;
    private _connection?: IKernelConnection;
    private connectionFile: string;
    public get process(): ChildProcess | undefined {
        return this._process;
    }
    public get connection(): IKernelConnection | undefined {
        return this._connection;
    }

    constructor(
        @inject(IPythonExecutionFactory) private executionFactory: IPythonExecutionFactory,
        @inject(IFileSystem) private file: IFileSystem
    ) {
        this.connectionFile = path.join(os.tmpdir(), `tmp_${Date.now()}_k.json`);
    }

    public async launch(interpreter: InterpreterUri, kernelSpec: IJupyterKernelSpec): Promise<void> {
        const resource = isResource(interpreter) ? interpreter : undefined;
        const pythonPath = isResource(interpreter) ? undefined : interpreter.path;

        const args = kernelSpec.argv;
        this._connection = await this.getKernelConnection();
        await this.file.writeFile(this.connectionFile, JSON.stringify(this._connection), {
            encoding: 'utf-8',
            flag: 'w'
        });
        args[4] = this.connectionFile;
        args.splice(0, 1);

        const executionService = await this.executionFactory.create({ resource, pythonPath });
        const kernelProcess = executionService.execObservable(args, {});

        this._process = kernelProcess.proc;
    }

    public async dispose() {
        this._process?.kill();
        try {
            await this.file.deleteFile(this.connectionFile);
        } catch {
            noop();
        }
    }

    private async getKernelConnection(): Promise<IKernelConnection> {
        const getPorts = promisify(portfinder.getPorts);
        const ports = await getPorts(5, { host: '127.0.0.1', port: 9000 });

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

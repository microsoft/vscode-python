// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { InterpreterUri } from '../../common/installer/types';
import { IFileSystem } from '../../common/platform/types';
import { isResource } from '../../common/utils/misc';
import { IInterpreterService, PythonInterpreter } from '../../interpreter/contracts';
import { IJupyterKernelSpec } from '../types';
import { IKernelFinder, IKernelLauncher, IKernelProcess } from './types';

@injectable()
export class KernelLauncher implements IKernelLauncher {
    constructor(
        @inject(IInterpreterService) private interpreterService: IInterpreterService,
        @inject(IFileSystem) private file: IFileSystem,
        @inject(IKernelFinder) private kernelFinder: IKernelFinder,
        @inject(IKernelProcess) private kernelProcess: IKernelProcess
    ) {}

    public async launch(interpreterUri: InterpreterUri, kernelName?: string): Promise<IKernelProcess> {
        const resource = isResource(interpreterUri) ? interpreterUri : undefined;
        const notebookInterpreter = isResource(interpreterUri) ? undefined : interpreterUri;
        let kernelSpec: IJupyterKernelSpec | undefined;
        let currentInterpreter: PythonInterpreter | undefined;

        if (!notebookInterpreter) {
            currentInterpreter = await this.interpreterService.getActiveInterpreter(resource);

            if (currentInterpreter) {
                kernelSpec = await this.getKernelSpec(path.join(currentInterpreter.path, 'share/jupyter/kernels/'));
            }
        }

        if (!kernelSpec) {
            const interpreters = await this.interpreterService.getInterpreters();
            const interpreterPaths = interpreters.map(interp => interp.path);

            kernelSpec = await this.kernelFinder.findKernelSpec(interpreterPaths, currentInterpreter, kernelName);
        }

        await this.kernelProcess.launch(interpreterUri, kernelSpec);
        return this.kernelProcess;
    }

    private async getKernelSpec(currentInterpreterPath: string): Promise<IJupyterKernelSpec | undefined> {
        const pathExists = await this.file.fileExists(currentInterpreterPath);

        if (pathExists) {
            const kernels = await this.file.getSubDirectories(currentInterpreterPath);

            return JSON.parse(
                await this.file.readFile(path.join(currentInterpreterPath, kernels[0], '/kernel.json'))
            ) as IJupyterKernelSpec;
        }

        return undefined;
    }
}

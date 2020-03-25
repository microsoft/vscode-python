// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { IFileSystem, IPlatformService } from '../../common/platform/types';
import { IPersistentState, IPersistentStateFactory } from '../../common/types';
import { PythonInterpreter } from '../../interpreter/contracts';
import { IJupyterKernelSpec } from '../types';
import { IKernelFinder } from './types';

const windowsPaths = new Map([
    ['users', process.env.HOMEPATH?.substr(0, 9)],
    ['jupyter', '\\AppData\\Roaming\\jupyter\\kernels\\'],
    ['kernel', 'share\\jupyter\\kernels\\']
]);

const unixPaths = new Map([
    ['home', process.env.HOME],
    ['linuxJupyterPath', '/.local/share/jupyter/kernels/'],
    ['macJupyterPath', '/Library/Jupyter/kernels/'],
    ['kernel', 'share/jupyter/kernels/']
]);

// This class searches for a kernel that matches the given kernel name.
// First it seraches on a global persistent state, then on the installed python interpreters,
// and finally on the default locations that jupyter installs kernels on.
// If a kernel name is not given, it returns a default IJupyterKernelSpec created from the current interpreter.
@injectable()
export class KernelFinder implements IKernelFinder {
    private state: IPersistentState<Map<string, string>>;

    constructor(
        @inject(IPlatformService) private platformService: IPlatformService,
        @inject(IFileSystem) private file: IFileSystem,
        @inject(IPersistentStateFactory) private stateFactory: IPersistentStateFactory
    ) {
        this.state = this.stateFactory.createGlobalPersistentState<Map<string, string>>('cachedPaths', new Map());
    }

    public async findKernelSpec(
        interpreterPaths: string[],
        currentInterpreter: PythonInterpreter | undefined,
        kernelName?: string
    ): Promise<IJupyterKernelSpec> {
        if (kernelName) {
            let spec = await this.findCachePath(kernelName);

            if (!spec) {
                spec = await this.findInterpreterPath(interpreterPaths, kernelName);
            }

            if (!spec) {
                spec = await this.findDiskPath(kernelName);
            }

            return spec ? spec : this.getDefaultKernelSpec(currentInterpreter);
        }

        return this.getDefaultKernelSpec(currentInterpreter);
    }

    private async getKernelSpec(kernelPath: string, kernelName: string): Promise<IJupyterKernelSpec | undefined> {
        const kernelJSON = '\\kernel.json';
        const pathExists = await this.file.fileExists(kernelPath);

        if (pathExists) {
            const kernels = await this.file.getSubDirectories(kernelPath);

            const promises = kernels.map(async kernel => {
                const kernelSpec: IJupyterKernelSpec = JSON.parse(
                    await this.file.readFile(path.join(kernelPath, kernel, kernelJSON))
                );
                this.state.value.set(path.join(kernelPath, kernel, kernelJSON), kernelSpec.display_name);
                return kernelSpec;
            });

            const specs = await Promise.all(promises);
            return specs.find(sp => kernelName === sp.name || kernelName === sp.display_name);
        }
    }

    private async findCachePath(kernelName: string): Promise<IJupyterKernelSpec | undefined> {
        for (const entry of this.state.value.entries()) {
            if (entry[1] === kernelName) {
                return JSON.parse(await this.file.readFile(entry[0])) as Promise<IJupyterKernelSpec>;
            }
        }
    }

    private async findInterpreterPath(
        interpreterPaths: string[],
        kernelName: string
    ): Promise<IJupyterKernelSpec | undefined> {
        const promises = interpreterPaths.map(intPath =>
            this.getKernelSpec(path.join(intPath, unixPaths.get('kernel')!), kernelName)
        );

        const specs = await Promise.all(promises);
        return specs.find(sp => sp !== undefined);
    }

    private async findDiskPath(kernelName: string): Promise<IJupyterKernelSpec | undefined> {
        // Jupyter looks for kernels in these paths:
        // https://jupyter-client.readthedocs.io/en/stable/kernels.html#kernel-specs
        // So we do the same
        let spec: IJupyterKernelSpec | undefined;

        if (this.platformService.isWindows) {
            // system paths
            spec = await this.getKernelSpec(path.join('C:\\ProgramData\\jupyter\\kernels\\'), kernelName);
            if (spec) {
                return spec;
            }

            // users paths
            const userPathExists = await this.file.fileExists(windowsPaths.get('users')!);
            if (userPathExists) {
                const users = await this.file.getSubDirectories(windowsPaths.get('users')!);

                const promises = users.map(user =>
                    this.getKernelSpec(
                        path.join(windowsPaths.get('users')!, user, windowsPaths.get('jupyter')!),
                        kernelName
                    )
                );

                const specs = await Promise.all(promises);
                return specs.find(sp => sp !== undefined);
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
            const userPathExists = await this.file.fileExists(unixPaths.get('home')!);
            if (userPathExists) {
                const users = await this.file.getSubDirectories(unixPaths.get('home')!);

                const promises = users.map(user => {
                    const secondPart = this.platformService.isMac
                        ? unixPaths.get('macJupyterPath')!
                        : unixPaths.get('linuxJupyterPath')!;
                    return this.getKernelSpec(path.join(unixPaths.get('home')!, user, secondPart), kernelName);
                });

                const specs = await Promise.all(promises);
                return specs.find(sp => sp !== undefined);
            }
        }
    }

    private getDefaultKernelSpec(currentInterpreter: PythonInterpreter | undefined): IJupyterKernelSpec {
        return {
            name: currentInterpreter?.displayName ? currentInterpreter.displayName : 'Python',
            language: 'python',
            path: currentInterpreter?.path!,
            display_name: currentInterpreter?.displayName ? currentInterpreter.displayName : 'Python',
            metadata: {},
            argv: ['-m', 'ipykernel_launcher']
        };
    }
}

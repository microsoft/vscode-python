// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { CancellationToken } from 'vscode';
import { createPromiseFromCancellation } from '../../common/cancellation';
import { IFileSystem, IPlatformService } from '../../common/platform/types';
import { IPathUtils, IPersistentState, IPersistentStateFactory, Resource } from '../../common/types';
import { IInterpreterService, PythonInterpreter } from '../../interpreter/contracts';
import { IJupyterKernelSpec } from '../types';
import { IKernelFinder } from './types';

// This class searches for a kernel that matches the given kernel name.
// First it seraches on a global persistent state, then on the installed python interpreters,
// and finally on the default locations that jupyter installs kernels on.
// If a kernel name is not given, it returns a default IJupyterKernelSpec created from the current interpreter.
@injectable()
export class KernelFinder implements IKernelFinder {
    private cachedKernelSpecs: IPersistentState<Map<string, string>>;
    private activeInterpreter: PythonInterpreter | undefined;

    private kernelPaths = new Map([
        ['winJupyterPath', '/AppData/Roaming/jupyter/kernels/'],
        ['linuxJupyterPath', '/.local/share/jupyter/kernels/'],
        ['macJupyterPath', '/Library/Jupyter/kernels/'],
        ['kernel', 'share/jupyter/kernels/']
    ]);

    constructor(
        @inject(IInterpreterService) private interpreterService: IInterpreterService,
        @inject(IPlatformService) private platformService: IPlatformService,
        @inject(IFileSystem) private file: IFileSystem,
        @inject(IPersistentStateFactory) private stateFactory: IPersistentStateFactory,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils
    ) {
        this.cachedKernelSpecs = this.stateFactory.createGlobalPersistentState<Map<string, string>>(
            'cachedPaths',
            new Map()
        );
    }

    public async findKernelSpec(
        resource: Resource,
        token: CancellationToken,
        kernelName?: string
    ): Promise<IJupyterKernelSpec> {
        if (kernelName) {
            const result = await Promise.race([
                this.findCachePath(kernelName),
                this.interpreterService.getInterpreters(resource).then(interpreters => {
                    const interpreterPaths = interpreters.map(interp => interp.path);
                    return this.findInterpreterPath(interpreterPaths, kernelName);
                }),
                this.findDiskPath(kernelName),
                createPromiseFromCancellation({
                    defaultValue: undefined,
                    cancelAction: 'resolve',
                    token: token
                })
            ]);

            return result ? result : this.getDefaultKernelSpec(resource);
        }

        return this.getDefaultKernelSpec(resource);
    }

    public async getKernelSpecFromActiveInterpreter(
        resource: Resource,
        kernelName?: string
    ): Promise<IJupyterKernelSpec | undefined> {
        this.activeInterpreter = await this.interpreterService.getActiveInterpreter(resource);

        if (this.activeInterpreter) {
            return this.getKernelSpec(path.join(this.activeInterpreter.path, 'share/jupyter/kernels/'), kernelName);
        }
    }

    private async getKernelSpec(kernelPath: string, kernelName?: string): Promise<IJupyterKernelSpec | undefined> {
        const kernelJSON = '\\kernel.json';
        const pathExists = await this.file.fileExists(kernelPath);

        if (pathExists) {
            const kernels = await this.file.getSubDirectories(kernelPath);

            // If no kernel name is included, return the first kernel
            if (!kernelName) {
                try {
                    return JSON.parse(
                        await this.file.readFile(path.join(kernelPath, kernels[0], '/kernel.json'))
                    ) as IJupyterKernelSpec;
                } catch {
                    return undefined;
                }
            }

            const promises = kernels.map(async kernel => {
                try {
                    const kernelSpec: IJupyterKernelSpec = JSON.parse(
                        await this.file.readFile(path.join(kernelPath, kernel, kernelJSON))
                    );
                    this.cachedKernelSpecs.value.set(path.join(kernelPath, kernel), JSON.stringify(kernelSpec));
                    return kernelSpec;
                } catch {
                    return undefined;
                }
            });

            const specs = await Promise.all(promises);
            return specs.find(sp => kernelName === sp?.name);
        }
    }

    private async findCachePath(kernelName: string): Promise<IJupyterKernelSpec | undefined> {
        for (const entry of this.cachedKernelSpecs.value.entries()) {
            const kernelSpec: IJupyterKernelSpec = JSON.parse(entry[1]);
            if (kernelSpec.name === kernelName) {
                return kernelSpec;
            }
        }
    }

    private async findInterpreterPath(
        interpreterPaths: string[],
        kernelName: string
    ): Promise<IJupyterKernelSpec | undefined> {
        const promises = interpreterPaths.map(intPath =>
            this.getKernelSpec(path.join(intPath, this.kernelPaths.get('kernel')!), kernelName)
        );

        const specs = await Promise.all(promises);
        return specs.find(sp => sp !== undefined);
    }

    // Jupyter looks for kernels in these paths:
    // https://jupyter-client.readthedocs.io/en/stable/kernels.html#kernel-specs
    private async findDiskPath(kernelName: string): Promise<IJupyterKernelSpec | undefined> {
        if (this.platformService.isWindows) {
            const promises = [
                path.join(process.env.ALLUSERSPROFILE!, '\\jupyter\\kernels\\'),
                path.join(this.pathUtils.home, this.kernelPaths.get('winJupyterPath')!)
            ].map(kernelPath => this.getKernelSpec(kernelPath, kernelName));

            const specs = await Promise.all(promises);
            return specs.find(sp => kernelName === sp?.name);
        } else {
            // Unix based
            const secondPart = this.platformService.isMac
                ? this.kernelPaths.get('macJupyterPath')!
                : this.kernelPaths.get('linuxJupyterPath')!;

            const promises = [
                '/usr/share/jupyter/kernels',
                '/usr/local/share/jupyter/kernels',
                path.join(this.pathUtils.home, secondPart)
            ].map(kernelPath => this.getKernelSpec(kernelPath, kernelName));

            const specs = await Promise.all(promises);
            return specs.find(sp => kernelName === sp?.name);
        }
    }

    private async getDefaultKernelSpec(resource: Resource): Promise<IJupyterKernelSpec> {
        if (!this.activeInterpreter) {
            this.activeInterpreter = await this.interpreterService.getActiveInterpreter(resource);
        }

        return {
            name: this.activeInterpreter?.envName ? this.activeInterpreter.envName : 'Python 3',
            language: 'python',
            path: this.activeInterpreter?.path!,
            display_name: this.activeInterpreter?.displayName ? this.activeInterpreter.displayName : 'Python 3',
            metadata: {},
            argv: ['<python path>', '-m', 'ipykernel_launcher', '-f', '{connection_file}']
        };
    }
}

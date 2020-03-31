// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { inject, injectable } from 'inversify';
import * as path from 'path';
import { CancellationToken } from 'vscode';
import { createPromiseFromCancellation } from '../../common/cancellation';
import { InterpreterUri } from '../../common/installer/types';
import { traceError, traceInfo } from '../../common/logger';
import { IFileSystem, IPlatformService } from '../../common/platform/types';
import { IPathUtils, Resource } from '../../common/types';
import { isResource } from '../../common/utils/misc';
import { EXTENSION_ROOT_DIR } from '../../constants';
import { IInterpreterService, PythonInterpreter } from '../../interpreter/contracts';
import { IJupyterKernelSpec } from '../types';
import { IKernelFinder } from './types';

const kernelPaths = new Map([
    ['winJupyterPath', '/AppData/Roaming/jupyter/kernels/'],
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
    private cachedKernelSpecs: IJupyterKernelSpec[] = [];
    private activeInterpreter: PythonInterpreter | undefined;

    constructor(
        @inject(IInterpreterService) private interpreterService: IInterpreterService,
        @inject(IPlatformService) private platformService: IPlatformService,
        @inject(IFileSystem) private file: IFileSystem,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils
    ) {}

    public async findKernelSpec(
        interpreterUri: InterpreterUri,
        token: CancellationToken,
        kernelName?: string
    ): Promise<IJupyterKernelSpec> {
        const resource = isResource(interpreterUri) ? interpreterUri : undefined;
        const notebookInterpreter = isResource(interpreterUri) ? undefined : interpreterUri;

        if (kernelName) {
            let kernelSpec = await this.findCachePath(kernelName);

            if (kernelSpec) {
                return kernelSpec;
            }

            if (!notebookInterpreter) {
                kernelSpec = await this.getKernelSpecFromActiveInterpreter(resource, kernelName);
            }

            if (kernelSpec) {
                return kernelSpec;
            }

            const kernelSearches = [
                this.interpreterService.getInterpreters(resource).then((interpreters) => {
                    const interpreterPaths = interpreters.map((interp) => interp.path);
                    return this.findInterpreterPath(interpreterPaths, kernelName);
                }),
                this.findDiskPath(kernelName),
                createPromiseFromCancellation({
                    defaultValue: undefined,
                    cancelAction: 'resolve',
                    token: token
                })
            ];

            const result = await Promise.race(kernelSearches);
            return result ? result : this.getDefaultKernelSpec(resource);
        }

        return this.getDefaultKernelSpec(resource);
    }

    private async getKernelSpecFromActiveInterpreter(
        resource: Resource,
        kernelName?: string
    ): Promise<IJupyterKernelSpec | undefined> {
        this.activeInterpreter = await this.interpreterService.getActiveInterpreter(resource);

        if (this.activeInterpreter) {
            return this.getKernelSpec(path.join(this.activeInterpreter.path, 'share/jupyter/kernels/'), kernelName);
        }
    }

    private async getKernelSpec(kernelPath: string, kernelName?: string): Promise<IJupyterKernelSpec | undefined> {
        const pathExists = await this.file.directoryExists(kernelPath);

        if (pathExists) {
            let cache: IJupyterKernelSpec[] = [];
            try {
                // read cache file
                cache = JSON.parse(await this.file.readFile(path.join(EXTENSION_ROOT_DIR, 'kernelSpecCache.json')));
            } catch {
                traceInfo('No kernelSpec cache found.');
            }
            this.cachedKernelSpecs = [...cache];

            const kernels = await this.file.getSubDirectories(kernelPath);
            // If no kernel name is included, return the first kernel
            if (!kernelName) {
                try {
                    const kernelSpec: IJupyterKernelSpec = JSON.parse(
                        await this.file.readFile(path.join(kernelPath, kernels[0], '/kernel.json'))
                    );
                    this.cachedKernelSpecs.push(kernelSpec);
                    return kernelSpec;
                } catch (e) {
                    traceError('Invalid kernel.json', e);
                    return undefined;
                }
            }

            const promises = kernels.map(async (kernel) => {
                try {
                    const kernelSpec: IJupyterKernelSpec = JSON.parse(
                        await this.file.readFile(path.join(kernel, '/kernel.json'))
                    );
                    this.cachedKernelSpecs.push(kernelSpec);
                    return kernelSpec;
                } catch (e) {
                    traceError('Invalid kernel.json', e);
                    return undefined;
                }
            });

            const specs = await Promise.all(promises);
            // write cache file
            await this.file.writeFile(
                path.join(EXTENSION_ROOT_DIR, 'kernelSpecCache.json'),
                JSON.stringify(this.cachedKernelSpecs)
            );
            return specs.find((sp) => kernelName === sp?.name);
        }
    }

    private async findCachePath(kernelName: string): Promise<IJupyterKernelSpec | undefined> {
        try {
            // read cache file
            const cache: IJupyterKernelSpec[] = JSON.parse(
                await this.file.readFile(path.join(EXTENSION_ROOT_DIR, 'kernelSpecCache.json'))
            );
            return cache.find((ks) => ks.name === kernelName);
        } catch {
            traceInfo('No kernelSpec cache found.');
            return undefined;
        }
    }

    private async findInterpreterPath(
        interpreterPaths: string[],
        kernelName: string
    ): Promise<IJupyterKernelSpec | undefined> {
        const promises = interpreterPaths.map((intPath) =>
            this.getKernelSpec(path.join(intPath, kernelPaths.get('kernel')!), kernelName)
        );

        const specs = await Promise.all(promises);
        return specs.find((sp) => sp !== undefined);
    }

    // Jupyter looks for kernels in these paths:
    // https://jupyter-client.readthedocs.io/en/stable/kernels.html#kernel-specs
    private async findDiskPath(kernelName: string): Promise<IJupyterKernelSpec | undefined> {
        if (this.platformService.isWindows) {
            const promises = [
                path.join(process.env.ALLUSERSPROFILE!, 'jupyter', 'kernels'),
                path.join(this.pathUtils.home, kernelPaths.get('winJupyterPath')!)
            ].map((kernelPath) => this.getKernelSpec(kernelPath, kernelName));

            const specs = await Promise.all(promises);
            return specs.find((sp) => kernelName === sp?.name);
        } else {
            // Unix based
            const secondPart = this.platformService.isMac
                ? kernelPaths.get('macJupyterPath')!
                : kernelPaths.get('linuxJupyterPath')!;

            const promises = [
                '/usr/share/jupyter/kernels',
                '/usr/local/share/jupyter/kernels',
                path.join(this.pathUtils.home, secondPart)
            ].map((kernelPath) => this.getKernelSpec(kernelPath, kernelName));

            const specs = await Promise.all(promises);
            return specs.find((sp) => kernelName === sp?.name);
        }
    }

    private async getDefaultKernelSpec(resource: Resource): Promise<IJupyterKernelSpec> {
        let cache: IJupyterKernelSpec[] = [];
        try {
            // read cache file
            cache = JSON.parse(await this.file.readFile(path.join(EXTENSION_ROOT_DIR, 'kernelSpecCache.json')));
        } catch {
            traceInfo('No kernelSpec cache found.');
        }
        this.cachedKernelSpecs = [...cache];

        if (!this.activeInterpreter) {
            this.activeInterpreter = await this.interpreterService.getActiveInterpreter(resource);
        }

        const defaultSpec = {
            name: `python_defaultSpec_${Date.now()}`,
            language: 'python',
            path: this.activeInterpreter?.path!,
            display_name: this.activeInterpreter?.displayName ? this.activeInterpreter.displayName : 'Python 3',
            metadata: {},
            argv: ['<python path>', '-m', 'ipykernel_launcher', '-f', '<connection_file>']
        };

        this.cachedKernelSpecs.push(defaultSpec);
        // write cache file
        await this.file.writeFile(
            path.join(EXTENSION_ROOT_DIR, 'kernelSpecCache.json'),
            JSON.stringify(this.cachedKernelSpecs)
        );

        return defaultSpec;
    }
}

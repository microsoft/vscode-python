// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { Kernel } from '@jupyterlab/services';
import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import { InterpreterUri } from '../../common/installer/types';
import { traceError, traceInfo } from '../../common/logger';
import { IFileSystem, IPlatformService } from '../../common/platform/types';
import { IExtensionContext, IPathUtils, Resource } from '../../common/types';
import { isResource } from '../../common/utils/misc';
import {
    IInterpreterLocatorService,
    IInterpreterService,
    KNOWN_PATH_SERVICE,
    PythonInterpreter
} from '../../interpreter/contracts';
import { JupyterKernelSpec } from '../jupyter/kernels/jupyterKernelSpec';
import { IJupyterKernelSpec } from '../types';
import { IKernelFinder } from './types';

const kernelPaths = new Map([
    ['winJupyterPath', path.join('AppData', 'Roaming', 'jupyter', 'kernels')],
    ['linuxJupyterPath', path.join('.local', 'share', 'jupyter', 'kernels')],
    ['macJupyterPath', path.join('Library', 'Jupyter', 'kernels')],
    ['kernel', path.join('share', 'jupyter', 'kernels')]
]);

// https://jupyter-client.readthedocs.io/en/stable/kernels.html
const connectionFilePlaceholder = '{connection_file}';

export function findIndexOfConnectionFile(kernelSpec: Readonly<IJupyterKernelSpec>): number {
    return kernelSpec.argv.indexOf(connectionFilePlaceholder);
}

// This class searches for a kernel that matches the given kernel name.
// First it seraches on a global persistent state, then on the installed python interpreters,
// and finally on the default locations that jupyter installs kernels on.
// If a kernel name is not given, it returns a default IJupyterKernelSpec created from the current interpreter.
@injectable()
export class KernelFinder implements IKernelFinder {
    private activeInterpreter: PythonInterpreter | undefined;
    private cache: IJupyterKernelSpec[] = [];

    constructor(
        @inject(IInterpreterService) private interpreterService: IInterpreterService,
        @inject(IInterpreterLocatorService)
        @named(KNOWN_PATH_SERVICE)
        private readonly interpreterLocator: IInterpreterLocatorService,
        @inject(IPlatformService) private platformService: IPlatformService,
        @inject(IFileSystem) private file: IFileSystem,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils,
        @inject(IExtensionContext) private readonly context: IExtensionContext
    ) {}

    public async findKernelSpec(interpreterUri: InterpreterUri, kernelName?: string): Promise<IJupyterKernelSpec> {
        this.cache = await this.readCache();
        let foundKernel: IJupyterKernelSpec | undefined;
        const resource = isResource(interpreterUri) ? interpreterUri : undefined;
        const notebookInterpreter = isResource(interpreterUri) ? undefined : interpreterUri;

        if (kernelName) {
            let kernelSpec = this.cache.find((ks) => ks.name === kernelName);

            if (kernelSpec) {
                return kernelSpec;
            }

            if (!notebookInterpreter) {
                kernelSpec = await this.getKernelSpecFromActiveInterpreter(resource, kernelName);
            }

            if (kernelSpec) {
                // tslint:disable-next-line: no-floating-promises
                this.writeCache(this.cache);
                return kernelSpec;
            }

            const diskSearch = this.findDiskPath(kernelName);
            const interpreterSearch = this.interpreterLocator.getInterpreters(resource, false).then((interpreters) => {
                const interpreterPaths = interpreters.map((interp) => interp.path);
                return this.findInterpreterPath(interpreterPaths, kernelName);
            });

            let result = await Promise.race([diskSearch, interpreterSearch]);
            if (!result) {
                const both = await Promise.all([diskSearch, interpreterSearch]);
                result = both[0] ? both[0] : both[1];
            }

            foundKernel = result ? result : await this.getDefaultKernelSpec(resource);
        } else {
            foundKernel = await this.getDefaultKernelSpec(resource);
        }

        // tslint:disable-next-line: no-floating-promises
        this.writeCache(this.cache);
        return foundKernel;
    }

    private async getKernelSpecFromActiveInterpreter(
        resource: Resource,
        kernelName: string
    ): Promise<IJupyterKernelSpec | undefined> {
        this.activeInterpreter = await this.interpreterService.getActiveInterpreter(resource);

        if (this.activeInterpreter) {
            return this.getKernelSpec(
                path.join(this.activeInterpreter.path, 'share', 'jupyter', 'kernels'),
                kernelName
            );
        }
    }

    private async getKernelSpec(kernelPath: string, kernelName: string): Promise<IJupyterKernelSpec | undefined> {
        try {
            const paths = await this.file.getSubDirectories(kernelPath);

            if (paths.length === 0) {
                return undefined;
            }

            return this.getKernelSpecFromDisk(paths, kernelName);
        } catch {
            traceInfo(`The path ${kernelPath} does not exist.`);
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
        let paths = [];

        if (this.platformService.isWindows) {
            paths = [path.join(this.pathUtils.home, kernelPaths.get('winJupyterPath')!)];

            if (process.env.ALLUSERSPROFILE) {
                paths.push(path.join(process.env.ALLUSERSPROFILE, 'jupyter', 'kernels'));
            }
        } else {
            // Unix based
            const secondPart = this.platformService.isMac
                ? kernelPaths.get('macJupyterPath')!
                : kernelPaths.get('linuxJupyterPath')!;

            paths = [
                path.join('usr', 'share', 'jupyter', 'kernels'),
                path.join('usr', 'local', 'share', 'jupyter', 'kernels'),
                path.join(this.pathUtils.home, secondPart)
            ];
        }

        return this.getKernelSpecFromDisk(paths, kernelName);
    }

    private async getKernelSpecFromDisk(paths: string[], kernelName: string): Promise<IJupyterKernelSpec | undefined> {
        const promises = paths.map((kernelPath) => this.file.search(kernelName, kernelPath));
        const searchResults = await Promise.all(promises);

        // tslint:disable-next-line: prefer-for-of
        for (let i = 0; i < searchResults.length; i += 1) {
            if (searchResults[i].length > 0) {
                try {
                    const kernelJsonFile = path.join(paths[i], searchResults[i][0], 'kernel.json');
                    const kernelJson = JSON.parse(await this.file.readFile(kernelJsonFile));
                    const kernelSpec: IJupyterKernelSpec = new JupyterKernelSpec(kernelJson, kernelJsonFile);
                    this.cache.push(kernelSpec);
                    return kernelSpec;
                } catch (e) {
                    traceError('Invalid kernel.json', e);
                    return undefined;
                }
            }
        }
        return undefined;
    }

    private async getDefaultKernelSpec(resource: Resource): Promise<IJupyterKernelSpec> {
        if (!this.activeInterpreter) {
            this.activeInterpreter = await this.interpreterService.getActiveInterpreter(resource);
        }

        const defaultSpec: Kernel.ISpecModel = {
            name: `python_defaultSpec_${Date.now()}`,
            language: 'python',
            path: '<path to kernel spec.json>',
            display_name: this.activeInterpreter?.displayName ? this.activeInterpreter.displayName : 'Python 3',
            metadata: {},
            argv: [
                this.activeInterpreter?.path || 'python',
                '-m',
                'ipykernel_launcher',
                '-f',
                connectionFilePlaceholder
            ],
            resources: {}
        };
        const kernelSpec = new JupyterKernelSpec(defaultSpec);
        this.cache.push(kernelSpec);
        return kernelSpec;
    }

    private async readCache(): Promise<IJupyterKernelSpec[]> {
        try {
            return JSON.parse(
                await this.file.readFile(path.join(this.context.globalStoragePath, 'kernelSpecCache.json'))
            ) as IJupyterKernelSpec[];
        } catch {
            traceInfo('No kernelSpec cache found.');
            return [];
        }
    }

    private async writeCache(cache: IJupyterKernelSpec[]) {
        await this.file.writeFile(
            path.join(this.context.globalStoragePath, 'kernelSpecCache.json'),
            JSON.stringify(cache)
        );
    }
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { Kernel } from '@jupyterlab/services';
import { inject, injectable, named } from 'inversify';
import * as path from 'path';
import { CancellationToken, CancellationTokenSource } from 'vscode';
import { wrapCancellationTokens } from '../../common/cancellation';
import { traceInfo } from '../../common/logger';
import { IFileSystem, IPlatformService } from '../../common/platform/types';
import { IExtensionContext, IInstaller, InstallerResponse, IPathUtils, Product, Resource } from '../../common/types';
import {
    IInterpreterLocatorService,
    IInterpreterService,
    KNOWN_PATH_SERVICE,
    PythonInterpreter
} from '../../interpreter/contracts';
import { captureTelemetry } from '../../telemetry';
import { Telemetry } from '../constants';
import { JupyterKernelSpec } from '../jupyter/kernels/jupyterKernelSpec';
import { IJupyterKernelSpec } from '../types';
import { getKernelInterpreter } from './helpers';
import { IKernelFinder } from './types';

const kernelPaths = new Map([
    ['winJupyterPath', path.join('AppData', 'Roaming', 'jupyter', 'kernels')],
    ['linuxJupyterPath', path.join('.local', 'share', 'jupyter', 'kernels')],
    ['macJupyterPath', path.join('Library', 'Jupyter', 'kernels')],
    ['kernel', path.join('share', 'jupyter', 'kernels')]
]);
const cacheFile = 'kernelSpecPathCache.json';
const defaultSpecName = 'python_defaultSpec_';

// https://jupyter-client.readthedocs.io/en/stable/kernels.html
const connectionFilePlaceholder = '{connection_file}';

export function findIndexOfConnectionFile(kernelSpec: Readonly<IJupyterKernelSpec>): number {
    return kernelSpec.argv.indexOf(connectionFilePlaceholder);
}

// This class searches for a kernel that matches the given kernel name.
// First it searches on a global persistent state, then on the installed python interpreters,
// and finally on the default locations that jupyter installs kernels on.
// If a kernel name is not given, it returns a default IJupyterKernelSpec created from the current interpreter.
// Before returning the IJupyterKernelSpec it makes sure that ipykernel is installed into the kernel spec interpreter
@injectable()
export class KernelFinder implements IKernelFinder {
    private activeInterpreter: PythonInterpreter | undefined;
    private cache: string[] = [];

    constructor(
        @inject(IInterpreterService) private interpreterService: IInterpreterService,
        @inject(IInterpreterLocatorService)
        @named(KNOWN_PATH_SERVICE)
        private readonly interpreterLocator: IInterpreterLocatorService,
        @inject(IPlatformService) private platformService: IPlatformService,
        @inject(IFileSystem) private file: IFileSystem,
        @inject(IPathUtils) private readonly pathUtils: IPathUtils,
        @inject(IInstaller) private installer: IInstaller,
        @inject(IExtensionContext) private readonly context: IExtensionContext
    ) {}

    @captureTelemetry(Telemetry.KernelFinderPerf)
    public async findKernelSpec(
        resource: Resource,
        kernelName?: string,
        cancelToken?: CancellationToken
    ): Promise<IJupyterKernelSpec> {
        this.cache = await this.readCache();
        let foundKernel: IJupyterKernelSpec | undefined;

        if (kernelName && !kernelName.includes(defaultSpecName)) {
            let kernelSpec = await this.searchCache(kernelName);

            if (kernelSpec) {
                return kernelSpec;
            }

            kernelSpec = await this.getKernelSpecFromActiveInterpreter(resource, kernelName);

            if (kernelSpec) {
                this.writeCache(this.cache).ignoreErrors();
                return kernelSpec;
            }

            const diskSearch = this.findDiskPath(kernelName);
            const interpreterSearch = this.interpreterLocator
                .getInterpreters(resource, { ignoreCache: false })
                .then((interpreters) => {
                    const interpreterPaths = interpreters.map((interp) => interp.sysPrefix);
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

        this.writeCache(this.cache).ignoreErrors();

        // Verify that ipykernel is installed into the given kernelspec interpreter
        return this.verifyIpyKernel(foundKernel, cancelToken);
    }

    // Search all our local file system locations for installed kernel specs and return them
    public async listKernelSpecs(_cancelToken?: CancellationToken): Promise<IJupyterKernelSpec[]> {
        throw new Error('Not yet implmented');
    }

    // For the given kernelspec return back the kernelspec with ipykernel installed into it or error
    private async verifyIpyKernel(
        kernelSpec: IJupyterKernelSpec,
        cancelToken?: CancellationToken
    ): Promise<IJupyterKernelSpec> {
        const interpreter = await getKernelInterpreter(kernelSpec, this.interpreterService);

        if (await this.installer.isInstalled(Product.ipykernel, interpreter)) {
            return kernelSpec;
        } else {
            const token = new CancellationTokenSource();
            const response = await this.installer.promptToInstall(
                Product.ipykernel,
                interpreter,
                wrapCancellationTokens(cancelToken, token.token)
            );
            if (response === InstallerResponse.Installed) {
                return kernelSpec;
            }
        }

        throw new Error(`IPyKernel not installed into interpreter ${interpreter.displayName}`);
    }

    private async getKernelSpecFromActiveInterpreter(
        resource: Resource,
        kernelName: string
    ): Promise<IJupyterKernelSpec | undefined> {
        this.activeInterpreter = await this.interpreterService.getActiveInterpreter(resource);

        if (this.activeInterpreter) {
            return this.getKernelSpecFromDisk(
                [path.join(this.activeInterpreter.sysPrefix, 'share', 'jupyter', 'kernels')],
                kernelName
            );
        }
    }

    private async findInterpreterPath(
        interpreterPaths: string[],
        kernelName: string
    ): Promise<IJupyterKernelSpec | undefined> {
        const promises = interpreterPaths.map((intPath) =>
            this.getKernelSpecFromDisk([path.join(intPath, kernelPaths.get('kernel')!)], kernelName)
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
        const promises = paths.map((kernelPath) => this.file.search('**/kernel.json', kernelPath));
        const searchResults = await Promise.all(promises);
        searchResults.forEach((result, i) => {
            result.forEach((res) => {
                const specPath = path.join(paths[i], res);
                if (!this.cache.includes(specPath)) {
                    this.cache.push(specPath);
                }
            });
        });

        return this.searchCache(kernelName);
    }

    private async getDefaultKernelSpec(resource: Resource): Promise<IJupyterKernelSpec> {
        if (!this.activeInterpreter) {
            this.activeInterpreter = await this.interpreterService.getActiveInterpreter(resource);
        }

        // This creates a default kernel spec. When launched, 'python' argument will map to using the interpreter
        // associated with the current resource for launching.
        const defaultSpec: Kernel.ISpecModel = {
            name: defaultSpecName + Date.now().toString(),
            language: 'python',
            display_name: this.activeInterpreter?.displayName ? this.activeInterpreter.displayName : 'Python 3',
            metadata: {},
            argv: ['python', '-m', 'ipykernel_launcher', '-f', connectionFilePlaceholder],
            env: {},
            resources: {}
        };
        return new JupyterKernelSpec(defaultSpec);
    }

    private async readCache(): Promise<string[]> {
        try {
            return JSON.parse(
                await this.file.readFile(path.join(this.context.globalStoragePath, cacheFile))
            ) as string[];
        } catch {
            traceInfo('No kernelSpec cache found.');
            return [];
        }
    }

    private async writeCache(cache: string[]) {
        await this.file.writeFile(path.join(this.context.globalStoragePath, cacheFile), JSON.stringify(cache));
    }

    private async searchCache(kernelName: string): Promise<IJupyterKernelSpec | undefined> {
        const kernelJsonFile = this.cache.find((kernelPath) => {
            try {
                return path.basename(path.dirname(kernelPath)) === kernelName;
            } catch (e) {
                traceInfo('KernelSpec path in cache is not a string.', e);
                return false;
            }
        });

        if (kernelJsonFile) {
            const kernelJson = JSON.parse(await this.file.readFile(kernelJsonFile));
            const spec = new JupyterKernelSpec(kernelJson, kernelJsonFile);
            spec.name = kernelName;
            return spec;
        }

        return undefined;
    }
}

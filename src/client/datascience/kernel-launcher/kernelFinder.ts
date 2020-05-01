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
    // IANHU: Set not []?
    private cache: string[] = [];

    // Store our results when listing all possible kernelspecs for a resource
    private resourceToKernels = new Map<Resource, Promise<IJupyterKernelSpec[]>>();

    // Store any json file that we have loaded from disk before
    private pathToKernelSpec = new Map<string, Promise<IJupyterKernelSpec>>();

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
        const activeInterpreter = await this.interpreterService.getActiveInterpreter(resource);

        if (kernelName && !kernelName.includes(defaultSpecName)) {
            let kernelSpec = await this.searchCache(kernelName);

            if (kernelSpec) {
                return kernelSpec;
            }

            // Check in active interpreter first
            if (activeInterpreter) {
                kernelSpec = await this.getKernelSpecFromActiveInterpreter(kernelName, resource);
            }

            if (kernelSpec) {
                this.writeCache(this.cache).ignoreErrors();
                return kernelSpec;
            }

            const diskSearch = this.findDiskPath(kernelName);
            const interpreterSearch = this.getInterpreterPaths(resource).then((interpreterPaths) => {
                return this.findInterpreterPath(interpreterPaths, kernelName);
            });

            let result = await Promise.race([diskSearch, interpreterSearch]);
            if (!result) {
                const both = await Promise.all([diskSearch, interpreterSearch]);
                result = both[0] ? both[0] : both[1];
            }

            foundKernel = result ? result : await this.getDefaultKernelSpec(activeInterpreter);
        } else {
            foundKernel = await this.getDefaultKernelSpec(activeInterpreter);
        }

        this.writeCache(this.cache).ignoreErrors();

        // Verify that ipykernel is installed into the given kernelspec interpreter
        return this.verifyIpyKernel(foundKernel, cancelToken);
    }

    // Search all our local file system locations for installed kernel specs and return them
    public async listKernelSpecs(resource: Resource, _cancelToken?: CancellationToken): Promise<IJupyterKernelSpec[]> {
        // If we have not already searched for this resource, then generate the search
        if (!this.resourceToKernels.has(resource)) {
            this.resourceToKernels.set(resource, this.findResourceKernelSpecs(resource, _cancelToken));
        }

        // ! as the has and set above verify that we have a return here
        return this.resourceToKernels.get(resource)!;
    }

    private async findResourceKernelSpecs(
        resource: Resource,
        _cancelToken?: CancellationToken
    ): Promise<IJupyterKernelSpec[]> {
        const results: IJupyterKernelSpec[] = [];

        // Find all the possible places to look for this resource
        const paths = await this.findAllResourcePossibleKernelPaths(resource);

        // Next search to find what actual json files there are
        // IANHU: Finder also doing something similar
        const promises = paths.map((kernelPath) => this.file.search('**/kernel.json', kernelPath));
        const searchResults = await Promise.all(promises);

        searchResults.forEach((result, i) => {
            result.forEach(async (jsonpath) => {
                // We are not using the cache for list all, but add the items that we find so the finder knows about them
                // Only push if it's not there already
                const specPath = path.join(paths[i], jsonpath);
                if (!this.cache.includes(specPath)) {
                    // IANHU: Don't mess with the cache while I'm still testing this
                    //this.cache.push(specPath);
                }

                const kernelspec = await this.getKernelSpec(specPath);
                results.push(kernelspec);
            });
        });

        return results;
    }

    // IANHU: have the finder code use this as well
    private async getKernelSpec(specPath: string): Promise<IJupyterKernelSpec> {
        // If we have not already searched for this resource, then generate the search
        if (!this.pathToKernelSpec.has(specPath)) {
            this.pathToKernelSpec.set(specPath, this.loadKernelSpec(specPath));
        }

        // ! as the has and set above verify that we have a return here
        return this.pathToKernelSpec.get(specPath)!;
    }

    // Load a kernelspec from disk
    private async loadKernelSpec(specPath: string): Promise<IJupyterKernelSpec> {
        const kernelJson = JSON.parse(await this.file.readFile(specPath));
        return new JupyterKernelSpec(kernelJson, specPath);
    }

    // For the given resource, find atll the file paths for kernel specs that wewant to associate with this
    private async findAllResourcePossibleKernelPaths(
        resource: Resource,
        _cancelToken?: CancellationToken
    ): Promise<string[]> {
        const [activePath, interpreterPaths, diskPaths] = await Promise.all([
            this.getActiveInterpreterPath(resource),
            this.getInterpreterPaths(resource),
            this.getDiskPaths()
        ]);

        return [...activePath, ...interpreterPaths, ...diskPaths];
    }

    private async getActiveInterpreterPath(resource: Resource): Promise<string[]> {
        const activeInterpreter = await this.interpreterService.getActiveInterpreter(resource);

        if (activeInterpreter) {
            return [path.join(activeInterpreter.sysPrefix, 'share', 'jupyter', 'kernels')];
        }

        return [];
    }

    private async getInterpreterPaths(resource: Resource): Promise<string[]> {
        const interpreters = await this.interpreterLocator.getInterpreters(resource, { ignoreCache: false });
        const interpreterPrefixPaths = interpreters.map((interpreter) => interpreter.sysPrefix);
        return interpreterPrefixPaths.map((prefixPath) => path.join(prefixPath, kernelPaths.get('kernel')!));
    }

    private async getDiskPaths(): Promise<string[]> {
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

        return paths;
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
        kernelName: string,
        resource: Resource
    ): Promise<IJupyterKernelSpec | undefined> {
        const activePath = await this.getActiveInterpreterPath(resource);
        return this.getKernelSpecFromDisk(activePath, kernelName);
    }

    private async findInterpreterPath(
        interpreterPaths: string[],
        kernelName: string
    ): Promise<IJupyterKernelSpec | undefined> {
        const promises = interpreterPaths.map((intPath) =>
            //this.getKernelSpecFromDisk([path.join(intPath, kernelPaths.get('kernel')!)], kernelName)
            this.getKernelSpecFromDisk([intPath], kernelName)
        );

        const specs = await Promise.all(promises);
        return specs.find((sp) => sp !== undefined);
    }

    // Jupyter looks for kernels in these paths:
    // https://jupyter-client.readthedocs.io/en/stable/kernels.html#kernel-specs
    private async findDiskPath(kernelName: string): Promise<IJupyterKernelSpec | undefined> {
        //let paths = [];

        //if (this.platformService.isWindows) {
        //paths = [path.join(this.pathUtils.home, kernelPaths.get('winJupyterPath')!)];

        //if (process.env.ALLUSERSPROFILE) {
        //paths.push(path.join(process.env.ALLUSERSPROFILE, 'jupyter', 'kernels'));
        //}
        //} else {
        //// Unix based
        //const secondPart = this.platformService.isMac
        //? kernelPaths.get('macJupyterPath')!
        //: kernelPaths.get('linuxJupyterPath')!;

        //paths = [
        //path.join('usr', 'share', 'jupyter', 'kernels'),
        //path.join('usr', 'local', 'share', 'jupyter', 'kernels'),
        //path.join(this.pathUtils.home, secondPart)
        //];
        //}
        const paths = await this.getDiskPaths();

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

    private async getDefaultKernelSpec(activeInterpreter?: PythonInterpreter): Promise<IJupyterKernelSpec> {
        // This creates a default kernel spec. When launched, 'python' argument will map to using the interpreter
        // associated with the current resource for launching.
        const defaultSpec: Kernel.ISpecModel = {
            name: defaultSpecName + Date.now().toString(),
            language: 'python',
            display_name: activeInterpreter?.displayName ? activeInterpreter.displayName : 'Python 3',
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

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Kernel, Session } from '@jupyterlab/services';
import * as fs from 'fs-extra';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as uuid from 'uuid/v4';

import { ExecutionResult, IPythonExecutionFactory, ObservableExecutionResult, SpawnOptions } from '../common/process/types';
import { ILogger } from '../common/types';
import * as localize from '../common/utils/localize';
import { ICondaService, IInterpreterService, InterpreterType } from '../interpreter/contracts';
import { IJupyterExecution, IJupyterKernelSpec } from './types';

class JupyterKernelSpec implements IJupyterKernelSpec {
    public name: string;
    public language: string;
    public path: string;
    constructor(specModel : Kernel.ISpecModel) {
        this.name = specModel.name;
        this.language = specModel.language;
        this.path = specModel.argv.length > 0 ? specModel.argv[0] : '';
    }
}

@injectable()
export class JupyterExecution implements IJupyterExecution {
    constructor(@inject(IPythonExecutionFactory) private executionFactory: IPythonExecutionFactory,
                @inject(ICondaService) private condaService: ICondaService,
                @inject(IInterpreterService) private interpreterService: IInterpreterService,
                @inject(ILogger) private logger: ILogger) {
    }

    public execModuleObservable = async (module: string, args: string[], options: SpawnOptions): Promise<ObservableExecutionResult<string>> => {
        const newOptions = {...options};
        newOptions.env = await this.fixupCondaEnv(newOptions.env);
        const pythonService = await this.executionFactory.create({});
        return pythonService.execModuleObservable(module, args, newOptions);
    }
    public execModule = async (module: string, args: string[], options: SpawnOptions): Promise<ExecutionResult<string>> => {
        const newOptions = {...options};
        newOptions.env = await this.fixupCondaEnv(newOptions.env);
        const pythonService = await this.executionFactory.create({});
        return pythonService.execModule(module, args, newOptions);
    }

    public isNotebookSupported = async (): Promise<boolean> => {
        // Spawn jupyter notebook --version and see if it returns something
        try {
            const result = await this.execModule('jupyter', ['notebook', '--version'], { throwOnStdErr: true, encoding: 'utf8' });
            return (!result.stderr);
        } catch (err) {
            this.logger.logWarning(err);
            return false;
        }
    }

    public isImportSupported = async (): Promise<boolean> => {
        // Spawn jupyter nbconvert --version and see if it returns something
        try {
            const result = await this.execModule('jupyter', ['nbconvert', '--version'], { throwOnStdErr: true, encoding: 'utf8' });
            return (!result.stderr);
        } catch (err) {
            this.logger.logWarning(err);
            return false;
        }
    }

    public isipykernelSupported = async (): Promise<boolean> => {
        // Spawn ipykernel --version and see if it returns something
        try {
            const result = await this.execModule('ipykernel', ['--version'], { throwOnStdErr: true, encoding: 'utf8' });
            return (!result.stderr);
        } catch (err) {
            this.logger.logWarning(err);
            return false;
        }
    }

    public isKernelSpecSupported = async (): Promise<boolean> => {
        // Spawn jupyter kernelspec --version and see if it returns something
        try {
            const result = await this.execModule('jupyter', ['kernelspec', '--version'], { throwOnStdErr: true, encoding: 'utf8' });
            return (!result.stderr);
        } catch (err) {
            this.logger.logWarning(err);
            return false;
        }
    }

    public async getMatchingKernelSpec(sessionManager?: Session.IManager) : Promise<IJupyterKernelSpec | undefined> {

        // If not using the session manager, check on disk
        if (!sessionManager) {
            // Enumerate our kernel specs that jupyter will know about and see if
            // one of them already matches based on path
            if (!await this.hasSpecPathMatch()) {
                // Nobody matches on path, so generate a new kernel spec
                if (await this.isipykernelSupported()) {
                    const displayName = localize.DataScience.historyTitle();
                    try {
                        // If this fails, then we just skip this spec
                        await this.execModule('ipykernel', ['install', '--user', '--name', uuid(), '--display-name', `'${displayName}'`], { throwOnStdErr: true, encoding: 'utf8' });
                    } catch (err) {
                        this.logger.logError(err);
                    }
                }
            }
        }

        // Now enumerate them again
        const enumerator = sessionManager ? () => this.getSessionManagerSpecs(sessionManager) : this.enumerateSpecs;

        // Then find our match
        return this.findSpecMatch(enumerator);
    }

    /**
     * Conda needs specific paths and env vars set to be happy. Call this function to fix up
     * (or created if not present) our environment to run jupyter
     */
    // Base Node.js SpawnOptions uses any for environment, so use that here as well
    // tslint:disable-next-line:no-any
    private fixupCondaEnv = async (inputEnv: any | undefined): Promise<any> => {
        if (!inputEnv) {
            inputEnv = process.env;
        }
        const interpreter = await this.interpreterService.getActiveInterpreter();
        if (interpreter && interpreter.type === InterpreterType.Conda) {
            return this.condaService.getActivatedCondaEnvironment(interpreter, inputEnv);
        }

        return inputEnv;
    }

    private hasSpecPathMatch = async () : Promise<boolean> => {
        // First get our current python path
        const pythonService = await this.executionFactory.create({});
        const info = await pythonService.getInterpreterInformation();

        // Then enumerate our specs
        const specs = await this.enumerateSpecs();

        // See if any of their paths match
        return specs.findIndex(s => info && s.path === info.path) >= 0;
    }

    //tslint:disable-next-line:cyclomatic-complexity
    private findSpecMatch = async (enumerator: () => Promise<IJupyterKernelSpec[]>) : Promise<IJupyterKernelSpec | undefined> => {
        // Extract our current python information that the user has picked.
        // We'll match against this.
        const pythonService = await this.executionFactory.create({});
        const info = await pythonService.getInterpreterInformation();
        let bestScore = 0;
        let bestSpec : IJupyterKernelSpec | undefined;

        // Then enumerate our specs
        const specs = await enumerator();

        for (let i = 0; specs && i < specs.length; i += 1) {
            const spec = specs[i];
            let score = 0;

            if (spec.path.length > 0 && info && spec.path === info.path) {
                // Path match
                score += 10;
            }
            if (spec.language.toLocaleLowerCase() === 'python') {
                // Language match
                score += 1;

                // See if the version is the same
                if (info && info.version_info && spec.path.length > 0 && await fs.pathExists(spec.path)) {
                    const details = await this.interpreterService.getInterpreterDetails(spec.path);
                    if (details && details.version_info) {
                        if (details.version_info[0] === info.version_info[0]) {
                            // Major version match
                            score += 4;

                            if (details.version_info[1] === info.version_info[1]) {
                                // Minor version match
                                score += 2;

                                if (details.version_info[2] === info.version_info[2]) {
                                    // Minor version match
                                    score += 1;
                                }
                            }
                        }
                    }
                } else if (info && info.version_info && spec.path.toLocaleLowerCase() === 'python') {
                    // This should be our current python.

                    // Search for a digit on the end of the name. It should match our major version
                    const match = /\D+(\d+)/.exec(spec.name);
                    if (match && match !== null && match.length > 0) {
                        // See if the version number matches
                        const nameVersion = parseInt(match[0], 10);
                        if (nameVersion && nameVersion === info.version_info[0]) {
                            score += 4;
                        }
                    }
                }
            }

            // Update high score
            if (score > bestScore) {
                bestScore = score;
                bestSpec = spec;
            }
        }

        // If still not set, at least pick the first one
        if (!bestSpec && specs && specs.length > 0) {
            bestSpec = specs[0];
        }

        return bestSpec;
    }

    private getSessionManagerSpecs = async (manager?: Session.IManager) : Promise<IJupyterKernelSpec[]> => {
        // Ask the session manager to refresh its list of kernel specs.
        await manager.refreshSpecs();

        // Enumerate all of the kernel specs, turning each into a JupyterKernelSpec
        const kernelspecs = manager.specs && manager.specs.kernelspecs ? manager.specs.kernelspecs : {};
        const keys = Object.keys(kernelspecs);
        return keys.map(k => {
            const spec = kernelspecs[k];
            return new JupyterKernelSpec(spec);
        });
    }

    private enumerateSpecs = async () : Promise<IJupyterKernelSpec[]> => {
        if (await this.isKernelSpecSupported()) {
            // Ask for our current list.
            const list = await this.execModule('jupyter', ['kernelspec', 'list'], { throwOnStdErr: true, encoding: 'utf8' });

            // This should give us back a key value pair we can parse
            const result: IJupyterKernelSpec[] = [];
            const lines = list.stdout.splitLines({ trim: false, removeEmptyEntries: true });
            for (let i = 0; i < lines.length; i += 1) {
                const match = /^\s+(\S+)\s*(\S+)$/.exec(lines[i]);
                if (match && match !== null && match.length > 2) {
                    // Second match should be our path to the kernel spec
                    const file = path.join(match[2], 'kernel.json');
                    if (await fs.pathExists(file)) {
                        // Turn this into a IJupyterKernelSpec
                        const model = await fs.readJSON(file, { encoding: 'utf8' });
                        model.name = match[1];
                        result.push(new JupyterKernelSpec(model));
                    }
                }
            }

            return result;
        }

        return [];
    }

}

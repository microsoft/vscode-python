// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { Kernel } from '@jupyterlab/services';
import * as os from 'os';
import * as path from 'path';
import { CancellationToken } from 'vscode';
import { createPromiseFromCancellation } from '../../../common/cancellation';
import { traceInfo } from '../../../common/logger';
import { IFileSystem } from '../../../common/platform/types';
import { IPythonExecutionFactory } from '../../../common/process/types';
import { PythonInterpreter } from '../../../pythonEnvironments/info';
import { IJupyterKernelSpec } from '../../types';

export class JupyterKernelSpec implements IJupyterKernelSpec {
    public name: string;
    public language: string;
    public path: string;
    public specFile: string | undefined;
    public readonly env: NodeJS.ProcessEnv | undefined;
    public display_name: string;
    public argv: string[];

    // tslint:disable-next-line: no-any
    public metadata?: Record<string, any> & { interpreter?: Partial<PythonInterpreter> };
    constructor(specModel: Kernel.ISpecModel, file?: string) {
        this.name = specModel.name;
        this.argv = specModel.argv;
        this.language = specModel.language;
        this.path = specModel.argv && specModel.argv.length > 0 ? specModel.argv[0] : '';
        this.specFile = file;
        this.display_name = specModel.display_name;
        this.metadata = specModel.metadata;
        // tslint:disable-next-line: no-any
        this.env = specModel.env as any; // JSONObject, but should match
    }
}

/**
 * Given the stdout contents from the command `python -m jupyter kernelspec list --json` this will parser that and build a list of kernelspecs.
 *
 * @export
 * @param {string} stdout
 * @param {IFileSystem} fs
 * @param {CancellationToken} [token]
 * @returns
 */
export async function parseKernelSpecs(
    stdout: string,
    fs: IFileSystem,
    execFactory: IPythonExecutionFactory,
    token?: CancellationToken
) {
    traceInfo('Parsing kernelspecs from jupyter');
    // This should give us back a key value pair we can parse
    const jsOut = JSON.parse(stdout.trim()) as {
        kernelspecs: Record<string, { resource_dir: string; spec: Omit<Kernel.ISpecModel, 'name'> }>;
    };
    const kernelSpecs = jsOut.kernelspecs;

    const specs = await Promise.race([
        Promise.all(
            Object.keys(kernelSpecs).map(async (kernelName) => {
                const spec = kernelSpecs[kernelName].spec as Kernel.ISpecModel;
                // Add the missing name property.
                const model = {
                    ...spec,
                    name: kernelName
                };
                const specFile = await getKernelSpecFile(
                    fs,
                    execFactory,
                    spec.argv[0],
                    path.join(kernelSpecs[kernelName].resource_dir, 'kernel.json')
                );
                if (specFile) {
                    return new JupyterKernelSpec(model as Kernel.ISpecModel, specFile);
                }
            })
        ),
        createPromiseFromCancellation({ cancelAction: 'resolve', defaultValue: [], token })
    ]);
    return specs.filter((item) => !!item).map((item) => item as JupyterKernelSpec);
}

export async function getKernelSpecFile(
    fs: IFileSystem,
    execFactory: IPythonExecutionFactory,
    pythonPath: string,
    expectedPath: string
): Promise<string | undefined> {
    if (await fs.fileExists(expectedPath)) {
        return expectedPath;
    }

    // On windows, a store installed python may not put kernel.json in the
    // spot returned by jupyter kernelspec list. Detect this situation and look in the
    // store cache location.
    // Not super happy with this. It's basically working around a bug in jupyter kernelspec list
    if (os.platform() === 'win32' && expectedPath.includes('Roaming')) {
        // Run this python and ask for its USER_BASE. That should have the
        // real location for jupyter kernels
        const pythonRunner = await execFactory.create({ pythonPath });
        const result = await pythonRunner.exec(['-c', 'import site;print(site.USER_BASE)'], {
            throwOnStdErr: false,
            encoding: 'utf-8'
        });
        if (result.stdout) {
            // Path should be one up and under 'Roaming\jupyter\kernels'
            const fileName = path.basename(expectedPath);
            const baseDirName = path.basename(path.dirname(expectedPath));
            const specFile = path.join(
                path.normalize(path.join(result.stdout, '..')),
                'Roaming',
                'jupyter',
                'kernels',
                baseDirName,
                fileName
            );
            if (await fs.fileExists(specFile)) {
                return specFile;
            }
        }
    }
}

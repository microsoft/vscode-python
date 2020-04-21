// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import type { Kernel } from '@jupyterlab/services';
import type { JSONObject } from '@phosphor/coreutils';
import * as path from 'path';
import { CancellationToken } from 'vscode';
import { createPromiseFromCancellation } from '../../../common/cancellation';
import { traceInfo } from '../../../common/logger';
import { IFileSystem } from '../../../common/platform/types';
import { PythonInterpreter } from '../../../interpreter/contracts';
import { IJupyterKernelSpec } from '../../types';

export class JupyterKernelSpec implements IJupyterKernelSpec {
    public name: string;
    public language: string;
    public path: string;
    public specFile: string | undefined;
    public display_name: string;
    public argv: string[];
    public readonly env?: JSONObject;

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
        this.env = specModel.env as any;
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
export async function parseKernelSpecs(stdout: string, fs: IFileSystem, token?: CancellationToken) {
    traceInfo('Parsing kernelspecs from jupyter');
    // This should give us back a key value pair we can parse
    const jsOut = JSON.parse(stdout.trim()) as {
        kernelspecs: Record<string, { resource_dir: string; spec: Omit<Kernel.ISpecModel, 'name'> }>;
    };
    const kernelSpecs = jsOut.kernelspecs;

    const specs = await Promise.race([
        Promise.all(
            Object.keys(kernelSpecs).map(async (kernelName) => {
                const specFile = path.join(kernelSpecs[kernelName].resource_dir, 'kernel.json');
                const spec = kernelSpecs[kernelName].spec;
                // Add the missing name property.
                const model = {
                    ...spec,
                    name: kernelName
                };
                // Check if the spec file exists.
                if (await fs.fileExists(specFile)) {
                    return new JupyterKernelSpec(model as Kernel.ISpecModel, specFile);
                } else {
                    return;
                }
            })
        ),
        createPromiseFromCancellation({ cancelAction: 'resolve', defaultValue: [], token })
    ]);
    return specs.filter((item) => !!item).map((item) => item as JupyterKernelSpec);
}

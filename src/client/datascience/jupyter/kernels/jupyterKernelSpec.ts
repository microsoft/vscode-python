// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Kernel } from '@jupyterlab/services';
import { PythonInterpreter } from '../../../interpreter/contracts';
import { IJupyterKernelSpec } from '../../types';

export class JupyterKernelSpec implements IJupyterKernelSpec {
    public name: string;
    public language: string;
    public path: string;
    public specFile: string | undefined;
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
    }
}

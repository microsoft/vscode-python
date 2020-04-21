// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { InterpreterUri } from '../../client/common/installer/types';
import { IKernelFinder } from '../../client/datascience/kernel-launcher/types';
import { IJupyterKernelSpec } from '../../client/datascience/types';

export class MockKernelFinder implements IKernelFinder {
    private dummySpecs = new Map<string, IJupyterKernelSpec>();

    constructor(private readonly realFinder: IKernelFinder) {}

    public async findKernelSpec(interpreterUri: InterpreterUri, kernelName?: string): Promise<IJupyterKernelSpec> {
        const spec = interpreterUri?.path
            ? this.dummySpecs.get(interpreterUri.path)
            : this.dummySpecs.get((interpreterUri || '').toString());
        if (spec) {
            return spec;
        }
        return this.realFinder.findKernelSpec(interpreterUri, kernelName);
    }

    public addKernelSpec(pythonPathOrResource: string, spec: IJupyterKernelSpec) {
        this.dummySpecs.set(pythonPathOrResource, spec);
    }
}

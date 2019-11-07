// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Kernel } from '@jupyterlab/services';
import * as fs from 'fs-extra';
import * as path from 'path';

import { noop } from '../../common/utils/misc';
import { IJupyterKernelSpec } from '../types';

const IsGuidRegEx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class JupyterKernelSpec implements IJupyterKernelSpec {
    public name: string;
    public language: string;
    public path: string;
    public specFile: string | undefined;
    constructor(specModel: Kernel.ISpecModel, file?: string) {
        this.name = specModel.name;
        this.language = specModel.language;
        this.path = specModel.argv && specModel.argv.length > 0 ? specModel.argv[0] : '';
        this.specFile = file;
    }
    public dispose = async () => {
        if (this.specFile &&
            IsGuidRegEx.test(path.basename(path.dirname(this.specFile)))) {
            // There is more than one location for the spec file directory
            // to be cleaned up. If one fails, the other likely deleted it already.
            try {
                await fs.remove(path.dirname(this.specFile));
            } catch {
                noop();
            }
            this.specFile = undefined;
        }
    }
}

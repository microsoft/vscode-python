// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import '../../common/extensions';

import { inject, injectable } from 'inversify';

import { IApplicationShell } from '../../common/application/types';
import { traceInfo } from '../../common/logger';
import { IOutputChannel } from '../../common/types';
import * as localize from '../../common/utils/localize';
import { IJupyterOutputListener } from '../types';

@injectable()
export class JupyterOutputListener implements IJupyterOutputListener {
    private output: IOutputChannel | undefined;
    constructor(
        @inject(IApplicationShell) private appShell: IApplicationShell
    ) {
    }

    public onOutput(data: string) {
        traceInfo(data);
        this.getOutputChannel().append(data);
    }

    private getOutputChannel(): IOutputChannel {
        if (!this.output) {
            this.output = this.appShell.createOutputChannel(localize.OutputChannelNames.jupyterServer());
        }
        return this.output;
    }

}

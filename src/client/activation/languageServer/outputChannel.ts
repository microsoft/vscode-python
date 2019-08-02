// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { IApplicationShell } from '../../common/application/types';
import { IOutputChannel } from '../../common/types';
import { OutputChannelNames } from '../../common/utils/localize';
import { ILanguageServerOutputChannel } from '../types';

@injectable()
export class LanguageServerOutputChannel implements ILanguageServerOutputChannel {
    public output: IOutputChannel | undefined;
    constructor(
        @inject(IApplicationShell) private readonly appShell: IApplicationShell
    ) { }

    public get channel() {
        if (!this.output) {
            this.output = this.appShell.createOutputChannel(OutputChannelNames.languageServer());
        }
        return this.output;
    }
}

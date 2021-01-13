// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';

import { LanguageServerAnalysisOptionsBase } from '../common/analysisOptions';
import { ILanguageServerOutputChannel } from '../types';

@injectable()
export class NodeLanguageServerAnalysisOptions extends LanguageServerAnalysisOptionsBase {
    constructor(@inject(ILanguageServerOutputChannel) lsOutputChannel: ILanguageServerOutputChannel) {
        super(lsOutputChannel);
    }

    protected async getInitializationOptions() {
        return {
            experimentationSupport: true,
        };
    }
}

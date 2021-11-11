// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import { IWorkspaceService } from '../../common/application/types';

import { LanguageServerAnalysisOptionsBase } from '../common/analysisOptions';
import { ILanguageServerOutputChannel } from '../types';

@injectable()
export class NodeLanguageServerAnalysisOptions extends LanguageServerAnalysisOptionsBase {
    constructor(
        @inject(ILanguageServerOutputChannel) lsOutputChannel: ILanguageServerOutputChannel,
        @inject(IWorkspaceService) workspace: IWorkspaceService,
    ) {
        super(lsOutputChannel, workspace);
    }

    protected async getInitializationOptions() {
        return {
            experimentationSupport: true,
        };
    }
}

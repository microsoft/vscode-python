// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IWorkspaceService } from '../../common/application/types';

import { LanguageServerAnalysisOptionsBase } from '../common/analysisOptions';
import { ILanguageServerOutputChannel } from '../types';

export class NodeLanguageServerAnalysisOptions extends LanguageServerAnalysisOptionsBase {
    constructor(lsOutputChannel: ILanguageServerOutputChannel, workspace: IWorkspaceService) {
        super(lsOutputChannel, workspace);
    }

    protected async getInitializationOptions() {
        return {
            experimentationSupport: true,
            trustedWorkspaceSupport: true,
        };
    }
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';

import { IWorkspaceService } from '../../common/application/types';
import { IEnvironmentVariablesProvider } from '../../common/variables/types';
import { LanguageServerAnalysisOptionsBase } from '../common/analysisOptions';
import { ILanguageServerOutputChannel } from '../types';

@injectable()
export class NodeLanguageServerAnalysisOptions extends LanguageServerAnalysisOptionsBase {
    constructor(
        @inject(IEnvironmentVariablesProvider) envVarsProvider: IEnvironmentVariablesProvider,
        @inject(IWorkspaceService) workspace: IWorkspaceService,
        @inject(ILanguageServerOutputChannel) lsOutputChannel: ILanguageServerOutputChannel
    ) {
        super(envVarsProvider, workspace, lsOutputChannel);
    }

    protected async getInitializationOptions() {
        return {};
    }
}

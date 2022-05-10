// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { LanguageClientOptions } from 'vscode-languageclient';
import { IWorkspaceService } from '../../common/application/types';

import { LanguageServerAnalysisOptionsBase } from '../common/analysisOptions';
import { ILanguageServerOutputChannel } from '../types';
import { LspNotebooksExperiment } from './lspNotebooksExperiment';

export class NodeLanguageServerAnalysisOptions extends LanguageServerAnalysisOptionsBase {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(
        lsOutputChannel: ILanguageServerOutputChannel,
        workspace: IWorkspaceService,
        private readonly lspNotebooksExperiment: LspNotebooksExperiment,
    ) {
        super(lsOutputChannel, workspace);
    }

    // eslint-disable-next-line class-methods-use-this
    protected async getInitializationOptions(): Promise<LanguageClientOptions> {
        return ({
            experimentationSupport: true,
            trustedWorkspaceSupport: true,
            lspNotebooksSupport: this.lspNotebooksExperiment.isInNotebooksExperiment(),
        } as unknown) as LanguageClientOptions;
    }
}

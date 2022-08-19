// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { LanguageClientOptions } from 'vscode-languageclient';
import { IWorkspaceService } from '../../common/application/types';
import { IConfigurationService, IExperimentService } from '../../common/types';

import { LanguageServerAnalysisOptionsBase } from '../common/analysisOptions';
import { ILanguageServerOutputChannel } from '../types';
import { LspNotebooksExperiment } from './lspNotebooksExperiment';

export class NodeLanguageServerAnalysisOptions extends LanguageServerAnalysisOptionsBase {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(
        lsOutputChannel: ILanguageServerOutputChannel,
        workspace: IWorkspaceService,
        private readonly configurationService: IConfigurationService,
        private readonly experimentService: IExperimentService,
        private readonly lspNotebooksExperiment: LspNotebooksExperiment,
    ) {
        super(lsOutputChannel, workspace);
    }

    // eslint-disable-next-line class-methods-use-this
    protected async getInitializationOptions(): Promise<LanguageClientOptions> {
        const inExperiment = await this.experimentService.inExperiment('pylanceAutoIndent');
        const pythonSettings = this.configurationService.getSettings();
        if (pythonSettings.formatOnType === undefined) {
            this.configurationService.updateSectionSetting('editor', 'formatOnType', true);
        }
        const enableAutoIndent = inExperiment && pythonSettings.formatOnType !== false;

        return ({
            experimentationSupport: true,
            trustedWorkspaceSupport: true,
            lspNotebooksSupport: this.lspNotebooksExperiment.isInNotebooksExperiment(),
            lspInteractiveWindowSupport: this.lspNotebooksExperiment.isInNotebooksExperimentWithInteractiveWindowSupport(),
            autoIndentSupport: enableAutoIndent,
        } as unknown) as LanguageClientOptions;
    }
}

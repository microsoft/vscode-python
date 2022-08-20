// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ConfigurationTarget } from 'vscode';
import { LanguageClientOptions } from 'vscode-languageclient';
import { IWorkspaceService } from '../../common/application/types';
import { IExperimentService } from '../../common/types';

import { LanguageServerAnalysisOptionsBase } from '../common/analysisOptions';
import { ILanguageServerOutputChannel } from '../types';
import { LspNotebooksExperiment } from './lspNotebooksExperiment';

export class NodeLanguageServerAnalysisOptions extends LanguageServerAnalysisOptionsBase {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(
        lsOutputChannel: ILanguageServerOutputChannel,
        workspace: IWorkspaceService,
        private readonly experimentService: IExperimentService,
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
            lspInteractiveWindowSupport: this.lspNotebooksExperiment.isInNotebooksExperimentWithInteractiveWindowSupport(),
            autoIndentSupport: await this.isAutoIndentEnabled(),
        } as unknown) as LanguageClientOptions;
    }

    private async isAutoIndentEnabled() {
        const editorConfig = this.workspace.getConfiguration('editor', undefined, /* languageSpecific */ true);
        const formatOnTypeSetting = 'formatOnType';
        const formatOnTypeEffectiveValue = editorConfig.get(formatOnTypeSetting);
        const formatOnTypeInspect = editorConfig.inspect(formatOnTypeSetting);

        let formatOnTypeSetForPython = false;
        if (formatOnTypeInspect?.languageIds) {
            formatOnTypeSetForPython = formatOnTypeInspect.languageIds.indexOf('python') >= 0;
        }

        let enableAutoIndent = formatOnTypeEffectiveValue;

        const inExperiment = await this.experimentService.inExperiment('pylanceAutoIndent');
        if (inExperiment && !formatOnTypeEffectiveValue && !formatOnTypeSetForPython) {
            editorConfig.update(
                formatOnTypeSetting,
                /* value */ true,
                ConfigurationTarget.Global,
                /* overrideInLanguage */ true,
            );
            enableAutoIndent = true;
        } else if (!inExperiment) {
            editorConfig.update(
                formatOnTypeSetting,
                /* value */ undefined,
                ConfigurationTarget.Global,
                /* overrideInLanguage */ true,
            );
        }

        return enableAutoIndent;
    }
}

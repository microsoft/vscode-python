// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ConfigurationTarget, WorkspaceConfiguration } from 'vscode';
import { LanguageClientOptions } from 'vscode-languageclient';
import { IWorkspaceService } from '../../common/application/types';
import { IExperimentService } from '../../common/types';

import { LanguageServerAnalysisOptionsBase } from '../common/analysisOptions';
import { ILanguageServerOutputChannel } from '../types';
import { LspNotebooksExperiment } from './lspNotebooksExperiment';

const editorConfigSection = 'editor';
const formatOnTypeConfigSetting = 'formatOnType';

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
        const editorConfig = this.getPythonSpecificEditorSection();
        let formatOnTypeEffectiveValue = editorConfig.get(formatOnTypeConfigSetting);
        const formatOnTypeInspect = editorConfig.inspect(formatOnTypeConfigSetting);
        const formatOnTypeSetForPython = formatOnTypeInspect?.globalLanguageValue !== undefined;

        const inExperiment = await this.experimentService.inExperiment('pylanceAutoIndent');

        if (inExperiment !== formatOnTypeSetForPython) {
            if (inExperiment) {
                await NodeLanguageServerAnalysisOptions.setPythonSpecificFormatOnType(editorConfig, true);
            } else if (formatOnTypeInspect?.globalLanguageValue !== false) {
                await NodeLanguageServerAnalysisOptions.setPythonSpecificFormatOnType(editorConfig, undefined);
            }

            formatOnTypeEffectiveValue = this.getPythonSpecificEditorSection().get(formatOnTypeConfigSetting);
        }

        return inExperiment && formatOnTypeEffectiveValue;
    }

    private getPythonSpecificEditorSection() {
        return this.workspace.getConfiguration(editorConfigSection, undefined, /* languageSpecific */ true);
    }

    private static async setPythonSpecificFormatOnType(
        editorConfig: WorkspaceConfiguration,
        value: boolean | undefined,
    ) {
        await editorConfig.update(
            formatOnTypeConfigSetting,
            value,
            ConfigurationTarget.Global,
            /* overrideInLanguage */ true,
        );
    }
}

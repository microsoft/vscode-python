// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ConfigurationTarget, extensions, WorkspaceConfiguration } from 'vscode';
import { LanguageClientOptions } from 'vscode-languageclient';
import * as semver from 'semver';
import { IWorkspaceService } from '../../common/application/types';
import { PYLANCE_EXTENSION_ID } from '../../common/constants';
import { IExperimentService } from '../../common/types';

import { LanguageServerAnalysisOptionsBase } from '../common/analysisOptions';
import { ILanguageServerOutputChannel } from '../types';
import { LspNotebooksExperiment } from './lspNotebooksExperiment';
import { traceWarn } from '../../logging';

const EDITOR_CONFIG_SECTION = 'editor';
const FORMAT_ON_TYPE_CONFIG_SETTING = 'formatOnType';

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

    protected getConfigSectionsToSynchronize(): string[] {
        return [...super.getConfigSectionsToSynchronize(), 'jupyter.runStartupCommands'];
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
        let formatOnTypeEffectiveValue = editorConfig.get(FORMAT_ON_TYPE_CONFIG_SETTING);
        const formatOnTypeInspect = editorConfig.inspect(FORMAT_ON_TYPE_CONFIG_SETTING);
        const formatOnTypeSetForPython = formatOnTypeInspect?.globalLanguageValue !== undefined;

        const inExperiment = await this.isInAutoIndentExperiment();

        if (inExperiment !== formatOnTypeSetForPython) {
            if (inExperiment) {
                await NodeLanguageServerAnalysisOptions.setPythonSpecificFormatOnType(editorConfig, true);
            } else if (formatOnTypeInspect?.globalLanguageValue !== false) {
                await NodeLanguageServerAnalysisOptions.setPythonSpecificFormatOnType(editorConfig, undefined);
            }

            formatOnTypeEffectiveValue = this.getPythonSpecificEditorSection().get(FORMAT_ON_TYPE_CONFIG_SETTING);
        }

        return inExperiment && formatOnTypeEffectiveValue;
    }

    private async isInAutoIndentExperiment(): Promise<boolean> {
        if (await this.experimentService.inExperiment('pylanceAutoIndent')) {
            return true;
        }

        const pylanceVersion = extensions.getExtension(PYLANCE_EXTENSION_ID)?.packageJSON.version as string;
        return pylanceVersion !== undefined && semver.prerelease(pylanceVersion)?.includes('dev') === true;
    }

    private getPythonSpecificEditorSection() {
        return this.workspace.getConfiguration(EDITOR_CONFIG_SECTION, undefined, /* languageSpecific */ true);
    }

    private static async setPythonSpecificFormatOnType(
        editorConfig: WorkspaceConfiguration,
        value: boolean | undefined,
    ) {
        try {
            await editorConfig.update(
                FORMAT_ON_TYPE_CONFIG_SETTING,
                value,
                ConfigurationTarget.Global,
                /* overrideInLanguage */ true,
            );
        } catch (ex) {
            traceWarn(`Failed to set formatOnType to ${value}`);
        }
    }
}

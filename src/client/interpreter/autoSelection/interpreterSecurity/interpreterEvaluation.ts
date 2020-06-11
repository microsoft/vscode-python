// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IApplicationShell } from '../../../common/application/types';
import { IBrowserService, Resource } from '../../../common/types';
import { Common, Interpreters } from '../../../common/utils/localize';
import { PythonInterpreter } from '../../../pythonEnvironments/discovery/types';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { IInterpreterHelper } from '../../contracts';
import { isInterpreterLocatedInWorkspace } from '../../helpers';
import { learnMoreOnInterpreterSecurityURI } from '../constants';
import { IInterpreterEvaluation, IInterpreterSecurityStorage } from '../types';

const prompts = [Common.bannerLabelYes(), Common.bannerLabelNo(), Common.learnMore(), Common.doNotShowAgain()];
const telemetrySelections: ['Yes', 'No', 'Learn more', 'Do not show again'] = [
    'Yes',
    'No',
    'Learn more',
    'Do not show again'
];

@injectable()
export class InterpreterEvaluation implements IInterpreterEvaluation {
    constructor(
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IBrowserService) private browserService: IBrowserService,
        @inject(IInterpreterHelper) private readonly interpreterHelper: IInterpreterHelper,
        @inject(IInterpreterSecurityStorage) private readonly interpreterSecurityStorage: IInterpreterSecurityStorage
    ) {}

    public async evaluateIfInterpreterIsSafe(interpreter: PythonInterpreter, resource: Resource): Promise<boolean> {
        const activeWorkspaceUri = this.interpreterHelper.getActiveWorkspaceUri(resource)?.folderUri;
        if (!activeWorkspaceUri) {
            return true;
        }
        const isSafe = this.inferValueUsingCurrentState(interpreter, resource);
        return isSafe !== undefined ? isSafe : this._inferValueUsingPrompt(activeWorkspaceUri);
    }

    public inferValueUsingCurrentState(interpreter: PythonInterpreter, resource: Resource) {
        const activeWorkspaceUri = this.interpreterHelper.getActiveWorkspaceUri(resource)?.folderUri;
        if (!activeWorkspaceUri) {
            return true;
        }
        if (!isInterpreterLocatedInWorkspace(interpreter, activeWorkspaceUri)) {
            return true;
        }
        const isSafe = this.interpreterSecurityStorage.hasUserApprovedWorkspaceInterpreters(activeWorkspaceUri).value;
        if (isSafe !== undefined) {
            return isSafe;
        }
        if (!this.interpreterSecurityStorage.unsafeInterpreterPromptEnabled.value) {
            // If the prompt is disabled, assume all environments are safe from now on.
            return true;
        }
    }

    public async _inferValueUsingPrompt(activeWorkspaceUri: Uri): Promise<boolean> {
        const areInterpretersInWorkspaceSafe = this.interpreterSecurityStorage.hasUserApprovedWorkspaceInterpreters(
            activeWorkspaceUri
        );
        await this.interpreterSecurityStorage.storeKeyForWorkspace(activeWorkspaceUri);
        let selection = await this.showPromptAndGetSelection();
        while (selection === Common.learnMore()) {
            this.browserService.launch(learnMoreOnInterpreterSecurityURI);
            selection = await this.showPromptAndGetSelection();
        }
        if (!selection || selection === Common.bannerLabelNo()) {
            await areInterpretersInWorkspaceSafe.updateValue(false);
            return false;
        } else if (selection === Common.doNotShowAgain()) {
            await this.interpreterSecurityStorage.unsafeInterpreterPromptEnabled.updateValue(false);
        }
        await areInterpretersInWorkspaceSafe.updateValue(true);
        return true;
    }

    private async showPromptAndGetSelection(): Promise<string | undefined> {
        const selection = await this.appShell.showInformationMessage(
            Interpreters.unsafeInterpreterMessage(),
            ...prompts
        );
        sendTelemetryEvent(EventName.UNSAFE_INTERPRETER_PROMPT, undefined, {
            selection: selection ? telemetrySelections[prompts.indexOf(selection)] : undefined
        });
        return selection;
    }
}

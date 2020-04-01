// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IApplicationShell } from '../../../common/application/types';
import { IBrowserService, IPersistentState, IPersistentStateFactory, Resource } from '../../../common/types';
import { Common, InteractiveShiftEnterBanner, Interpreters } from '../../../common/utils/localize';
import { sendTelemetryEvent } from '../../../telemetry';
import { EventName } from '../../../telemetry/constants';
import { IInterpreterHelper, PythonInterpreter } from '../../contracts';
import { isInterpreterStoredInWorkspace } from '../../helpers';
import { unsafeInterpreterPromptKey } from '../constants';
import { IInterpreterEvaluation, IInterpreterSecurityCommands } from '../types';

const prompts = [
    InteractiveShiftEnterBanner.bannerLabelYes(),
    InteractiveShiftEnterBanner.bannerLabelNo(),
    Common.learnMore(),
    Common.doNotShowAgain()
];

@injectable()
export class InterpreterEvaluation implements IInterpreterEvaluation {
    private unsafeInterpreterPromptEnabled: IPersistentState<boolean>;
    constructor(
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IApplicationShell) private readonly appShell: IApplicationShell,
        @inject(IBrowserService) private browserService: IBrowserService,
        @inject(IInterpreterHelper) private readonly interpreterHelper: IInterpreterHelper,
        @inject(IInterpreterSecurityCommands) private readonly interpreterSecurityCommands: IInterpreterSecurityCommands
    ) {
        this.unsafeInterpreterPromptEnabled = this.persistentStateFactory.createGlobalPersistentState(
            unsafeInterpreterPromptKey,
            true
        );
    }

    public async evaluateIfInterpreterIsSafe(interpreter: PythonInterpreter, resource: Resource): Promise<boolean> {
        const activeWorkspaceUri = this.interpreterHelper.getActiveWorkspaceUri(resource)?.folderUri;
        if (!activeWorkspaceUri) {
            return true;
        }
        const isSafe = this.inferValueUsingStorage(interpreter, resource);
        return isSafe !== undefined ? isSafe : this._inferValueUsingPrompt(activeWorkspaceUri);
    }

    public inferValueUsingStorage(interpreter: PythonInterpreter, resource: Resource) {
        const activeWorkspaceUri = this.interpreterHelper.getActiveWorkspaceUri(resource)?.folderUri;
        if (!activeWorkspaceUri) {
            return true;
        }
        if (!isInterpreterStoredInWorkspace(interpreter, activeWorkspaceUri)) {
            return true;
        }
        const isSafe = this._areInterpretersInWorkspaceSafe(activeWorkspaceUri);
        if (isSafe !== undefined) {
            return isSafe;
        }
        if (!this.unsafeInterpreterPromptEnabled.value) {
            // If the prompt is disabled, assume all environments are safe from now on.
            return true;
        }
    }

    public _areInterpretersInWorkspaceSafe(resource: Uri): boolean | undefined {
        const areInterpretersInWorkspaceSafe = this.persistentStateFactory.createGlobalPersistentState<
            boolean | undefined
        >(this.interpreterSecurityCommands.getKeyForWorkspace(resource), undefined);
        if (areInterpretersInWorkspaceSafe.value !== undefined) {
            return areInterpretersInWorkspaceSafe.value;
        }
    }

    public async _inferValueUsingPrompt(activeWorkspaceUri: Uri): Promise<boolean> {
        const areInterpretersInWorkspaceSafe = this.persistentStateFactory.createGlobalPersistentState<
            boolean | undefined
        >(this.interpreterSecurityCommands.getKeyForWorkspace(activeWorkspaceUri), undefined);
        let selection = await this.showPromptAndGetSelection();
        while (selection === Common.learnMore()) {
            this.browserService.launch('https://aka.ms/AA7jfor');
            selection = await this.showPromptAndGetSelection();
        }
        if (!selection || selection === InteractiveShiftEnterBanner.bannerLabelNo()) {
            await areInterpretersInWorkspaceSafe.updateValue(false);
            return false;
        } else if (selection === Common.doNotShowAgain()) {
            await this.unsafeInterpreterPromptEnabled.updateValue(false);
        }
        await areInterpretersInWorkspaceSafe.updateValue(true);
        return true;
    }

    private async showPromptAndGetSelection(): Promise<string | undefined> {
        const telemetrySelections: ['Yes', 'No', 'Learn more', 'Do not show again'] = [
            'Yes',
            'No',
            'Learn more',
            'Do not show again'
        ];
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

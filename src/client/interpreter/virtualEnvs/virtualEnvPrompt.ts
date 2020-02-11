// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { ConfigurationTarget, Disposable, Uri } from 'vscode';
import { IExtensionActivationService } from '../../activation/types';
import { IApplicationShell } from '../../common/application/types';
import { traceDecorators } from '../../common/logger';
import { IDisposableRegistry, IPersistentStateFactory } from '../../common/types';
import { sleep } from '../../common/utils/async';
import { Common, InteractiveShiftEnterBanner, Interpreters } from '../../common/utils/localize';
import { sendTelemetryEvent } from '../../telemetry';
import { EventName } from '../../telemetry/constants';
import { IPythonPathUpdaterServiceManager } from '../configuration/types';
import {
    IInterpreterHelper,
    IInterpreterLocatorService,
    IInterpreterWatcherBuilder,
    PythonInterpreter,
    WORKSPACE_VIRTUAL_ENV_SERVICE
} from '../contracts';

const doNotDisplayPromptStateKey = 'MESSAGE_KEY_FOR_VIRTUAL_ENV';
@injectable()
export class VirtualEnvironmentPrompt implements IExtensionActivationService {
    constructor(
        @inject(IInterpreterWatcherBuilder) private readonly builder: IInterpreterWatcherBuilder,
        @inject(IPersistentStateFactory) private readonly persistentStateFactory: IPersistentStateFactory,
        @inject(IInterpreterHelper) private readonly helper: IInterpreterHelper,
        @inject(IPythonPathUpdaterServiceManager)
        private readonly pythonPathUpdaterService: IPythonPathUpdaterServiceManager,
        @inject(IInterpreterLocatorService)
        @named(WORKSPACE_VIRTUAL_ENV_SERVICE)
        private readonly locator: IInterpreterLocatorService,
        @inject(IDisposableRegistry) private readonly disposableRegistry: Disposable[],
        @inject(IApplicationShell) private readonly appShell: IApplicationShell
    ) {}

    public async activate(resource: Uri): Promise<void> {
        const watcher = await this.builder.getWorkspaceVirtualEnvInterpreterWatcher(resource);
        watcher.onDidCreate(
            () => {
                this.handleNewEnvironment(resource).ignoreErrors();
            },
            this,
            this.disposableRegistry
        );
    }

    @traceDecorators.error('Error in event handler for detection of new environment')
    protected async handleNewEnvironment(resource: Uri): Promise<void> {
        // Wait for a while, to ensure environment gets created and is accessible (as this is slow on Windows)
        await sleep(1000);
        const interpreters = await this.locator.getInterpreters(resource);
        const interpreter = this.helper.getBestInterpreter(interpreters);
        if (!interpreter) {
            return;
        }
        await this.notifyUser(interpreter, resource);
    }
    protected async notifyUser(interpreter: PythonInterpreter, resource: Uri): Promise<void> {
        const notificationPromptEnabled = this.persistentStateFactory.createWorkspacePersistentState(
            doNotDisplayPromptStateKey,
            true
        );
        if (!notificationPromptEnabled.value) {
            return;
        }
        const prompts = [
            InteractiveShiftEnterBanner.bannerLabelYes(),
            InteractiveShiftEnterBanner.bannerLabelNo(),
            Common.doNotShowAgain()
        ];
        const telemetrySelections: ['Yes', 'No', 'Ignore'] = ['Yes', 'No', 'Ignore'];
        const selection = await this.appShell.showInformationMessage(
            Interpreters.environmentPromptMessage(),
            ...prompts
        );
        sendTelemetryEvent(EventName.PYTHON_INTERPRETER_ACTIVATE_ENVIRONMENT_PROMPT, undefined, {
            selection: selection ? telemetrySelections[prompts.indexOf(selection)] : undefined
        });
        if (!selection) {
            return;
        }
        if (selection === prompts[0]) {
            await this.pythonPathUpdaterService.updatePythonPath(
                interpreter.path,
                ConfigurationTarget.WorkspaceFolder,
                'ui',
                resource
            );
        } else if (selection === prompts[2]) {
            await notificationPromptEnabled.updateValue(false);
        }
    }
}

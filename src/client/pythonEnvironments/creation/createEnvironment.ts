// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

import { Event, EventEmitter, QuickInputButtons, QuickPickItem } from 'vscode';
import { CreateEnv } from '../../common/utils/localize';
import {
    MultiStepAction,
    MultiStepNode,
    showQuickPick,
    showQuickPickWithBack,
} from '../../common/vscodeApis/windowApis';
import { traceError, traceVerbose } from '../../logging';
import {
    CreateEnvironmentOptions,
    CreateEnvironmentResult,
    CreateEnvironmentProvider,
    EnvironmentWillCreateEvent,
    EnvironmentDidCreateEvent,
} from './proposed.createEnvApis';

const onCreateEnvironmentStartedEvent = new EventEmitter<EnvironmentWillCreateEvent>();
const onCreateEnvironmentExitedEvent = new EventEmitter<EnvironmentDidCreateEvent>();

let startedEventCount = 0;

function isBusyCreatingEnvironment(): boolean {
    return startedEventCount > 0;
}

function fireStartedEvent(options?: CreateEnvironmentOptions): void {
    onCreateEnvironmentStartedEvent.fire({ options });
    startedEventCount += 1;
}

function fireExitedEvent(result?: CreateEnvironmentResult, options?: CreateEnvironmentOptions, error?: Error): void {
    onCreateEnvironmentExitedEvent.fire({
        options,
        workspaceFolder: result?.workspaceFolder,
        path: result?.path,
        action: result?.action,
        error: error || result?.error,
    });
    startedEventCount -= 1;
}

export function getCreationEvents(): {
    onCreateEnvironmentStarted: Event<EnvironmentWillCreateEvent>;
    onCreateEnvironmentExited: Event<EnvironmentDidCreateEvent>;
    isCreatingEnvironment: () => boolean;
} {
    return {
        onCreateEnvironmentStarted: onCreateEnvironmentStartedEvent.event,
        onCreateEnvironmentExited: onCreateEnvironmentExitedEvent.event,
        isCreatingEnvironment: isBusyCreatingEnvironment,
    };
}

async function createEnvironment(
    provider: CreateEnvironmentProvider,
    options: CreateEnvironmentOptions,
): Promise<CreateEnvironmentResult | undefined> {
    let result: CreateEnvironmentResult | undefined;
    let err: Error | undefined;
    try {
        fireStartedEvent(options);
        result = await provider.createEnvironment(options);
    } catch (ex) {
        if (ex === QuickInputButtons.Back) {
            traceVerbose('Create Env: User clicked back button during environment creation');
            if (!options.showBackButton) {
                return undefined;
            }
        }
        err = ex as Error;
        throw err;
    } finally {
        fireExitedEvent(result, options, err);
    }
    return result;
}

interface CreateEnvironmentProviderQuickPickItem extends QuickPickItem {
    id: string;
}

async function showCreateEnvironmentQuickPick(
    providers: readonly CreateEnvironmentProvider[],
    options?: CreateEnvironmentOptions,
): Promise<CreateEnvironmentProvider | undefined> {
    const items: CreateEnvironmentProviderQuickPickItem[] = providers.map((p) => ({
        label: p.name,
        description: p.description,
        id: p.id,
    }));

    let selectedItem: CreateEnvironmentProviderQuickPickItem | CreateEnvironmentProviderQuickPickItem[] | undefined;

    if (options?.showBackButton) {
        selectedItem = await showQuickPickWithBack(items, {
            placeHolder: CreateEnv.providersQuickPickPlaceholder,
            matchOnDescription: true,
            ignoreFocusOut: true,
        });
    } else {
        selectedItem = await showQuickPick(items, {
            placeHolder: CreateEnv.providersQuickPickPlaceholder,
            matchOnDescription: true,
            ignoreFocusOut: true,
        });
    }

    if (selectedItem) {
        const selected = Array.isArray(selectedItem) ? selectedItem[0] : selectedItem;
        if (selected) {
            const selections = providers.filter((p) => p.id === selected.id);
            if (selections.length > 0) {
                return selections[0];
            }
        }
    }
    return undefined;
}

function getOptionsWithDefaults(options?: CreateEnvironmentOptions): CreateEnvironmentOptions {
    return {
        installPackages: true,
        ignoreSourceControl: true,
        showBackButton: false,
        selectEnvironment: true,
        ...options,
    };
}

export async function handleCreateEnvironmentCommand(
    providers: readonly CreateEnvironmentProvider[],
    options?: CreateEnvironmentOptions,
): Promise<CreateEnvironmentResult | undefined> {
    const optionsWithDefaults = getOptionsWithDefaults(options);
    let selectedProvider: CreateEnvironmentProvider | undefined;
    const envTypeStep = new MultiStepNode(
        undefined,
        async (context?: MultiStepAction) => {
            if (providers.length > 0) {
                try {
                    selectedProvider = await showCreateEnvironmentQuickPick(providers, optionsWithDefaults);
                } catch (ex) {
                    if (ex === MultiStepAction.Back || ex === MultiStepAction.Cancel) {
                        return ex;
                    }
                    throw ex;
                }
                if (!selectedProvider) {
                    return MultiStepAction.Cancel;
                }
            } else {
                traceError('No Environment Creation providers were registered.');
                if (context === MultiStepAction.Back) {
                    // There are no providers to select, so just step back.
                    return MultiStepAction.Back;
                }
            }
            return MultiStepAction.Continue;
        },
        undefined,
    );

    let result: CreateEnvironmentResult | undefined;
    const createStep = new MultiStepNode(
        envTypeStep,
        async (context?: MultiStepAction) => {
            if (context === MultiStepAction.Back) {
                // This step is to trigger creation, which can go into other extension.
                return MultiStepAction.Back;
            }
            if (selectedProvider) {
                try {
                    result = await createEnvironment(selectedProvider, optionsWithDefaults);
                } catch (ex) {
                    if (ex === MultiStepAction.Back || ex === MultiStepAction.Cancel) {
                        return ex;
                    }
                    throw ex;
                }
            }
            return MultiStepAction.Continue;
        },
        undefined,
    );
    envTypeStep.next = createStep;

    const action = await MultiStepNode.run(envTypeStep);
    if (options?.showBackButton) {
        if (action === MultiStepAction.Back || action === MultiStepAction.Cancel) {
            result = { action, workspaceFolder: undefined, path: undefined, error: undefined };
        }
    }

    return result;
}

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
import { CreateEnvironmentOptions, CreateEnvironmentProvider, CreateEnvironmentResult } from './types';

const onCreateEnvironmentStartedEvent = new EventEmitter<void>();
const onCreateEnvironmentExitedEvent = new EventEmitter<CreateEnvironmentResult | undefined>();

let startedEventCount = 0;

function isBusyCreatingEnvironment(): boolean {
    return startedEventCount > 0;
}

function fireStartedEvent(): void {
    onCreateEnvironmentStartedEvent.fire();
    startedEventCount += 1;
}

function fireExitedEvent(result: CreateEnvironmentResult | undefined): void {
    onCreateEnvironmentExitedEvent.fire(result);
    startedEventCount -= 1;
}

export function getCreationEvents(): {
    onCreateEnvironmentStarted: Event<void>;
    onCreateEnvironmentExited: Event<CreateEnvironmentResult | undefined>;
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
    options: CreateEnvironmentOptions = {
        ignoreSourceControl: true,
        installPackages: true,
    },
): Promise<CreateEnvironmentResult | undefined> {
    let result: CreateEnvironmentResult | undefined;
    try {
        fireStartedEvent();
        result = await provider.createEnvironment(options);
    } catch (ex) {
        if (ex === QuickInputButtons.Back) {
            traceVerbose('Create Env: User clicked back button during environment creation');
            if (!options.showBackButton) {
                return undefined;
            }
        }
        throw ex;
    } finally {
        fireExitedEvent(result);
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

export async function handleCreateEnvironmentCommand(
    providers: readonly CreateEnvironmentProvider[],
    options?: CreateEnvironmentOptions,
): Promise<CreateEnvironmentResult | undefined> {
    let selectedProvider: CreateEnvironmentProvider | undefined;
    const envTypeStep = new MultiStepNode(
        undefined,
        async (context?: MultiStepAction) => {
            if (providers.length > 0) {
                try {
                    selectedProvider = await showCreateEnvironmentQuickPick(providers, options);
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
                    result = await createEnvironment(selectedProvider, options);
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
            result = {
                path: result?.path,
                uri: result?.uri,
                action: action === MultiStepAction.Back ? 'Back' : 'Cancel',
            };
        }
    }

    return result;
}

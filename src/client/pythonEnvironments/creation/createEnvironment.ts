// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

import { Event, EventEmitter, QuickPickItem } from 'vscode';
import { CreateEnv } from '../../common/utils/localize';
import { showQuickPick } from '../../common/vscodeApis/windowApis';
import { traceError } from '../../logging';
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
): Promise<CreateEnvironmentProvider | undefined> {
    const items: CreateEnvironmentProviderQuickPickItem[] = providers.map((p) => ({
        label: p.name,
        description: p.description,
        id: p.id,
    }));
    const selected = await showQuickPick(items, {
        placeHolder: CreateEnv.providersQuickPickPlaceholder,
        matchOnDescription: true,
        ignoreFocusOut: true,
    });

    if (selected) {
        const selections = providers.filter((p) => p.id === selected.id);
        if (selections.length > 0) {
            return selections[0];
        }
    }
    return undefined;
}

export async function handleCreateEnvironmentCommand(
    providers: readonly CreateEnvironmentProvider[],
    options?: CreateEnvironmentOptions,
): Promise<CreateEnvironmentResult | undefined> {
    if (providers.length === 1) {
        return createEnvironment(providers[0], options);
    }
    if (providers.length > 1) {
        const provider = await showCreateEnvironmentQuickPick(providers);
        if (provider) {
            return createEnvironment(provider, options);
        }
    } else {
        traceError('No Environment Creation providers were registered.');
    }
    return undefined;
}

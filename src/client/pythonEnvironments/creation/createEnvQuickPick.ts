// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License

import * as nls from 'vscode-nls';
import { QuickPickItem } from 'vscode';
import { showQuickPick } from '../../common/vscodeApis/windowApis';
import { traceError } from '../../logging';
import { createEnvironment } from './createEnvironment';
import { CreateEnvironmentOptions, CreateEnvironmentProvider } from './types';

const localize: nls.LocalizeFunc = nls.loadMessageBundle();

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
        title: localize('python.createEnv.providersQuickPick.title', 'Select a virtual environment type.'),
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
): Promise<void> {
    if (providers.length === 1) {
        await createEnvironment(providers[0], options);
    } else if (providers.length > 1) {
        const provider = await showCreateEnvironmentQuickPick(providers);
        if (provider) {
            await createEnvironment(provider, options);
        }
    } else {
        traceError('No Environment Creation providers were registered.');
    }
}

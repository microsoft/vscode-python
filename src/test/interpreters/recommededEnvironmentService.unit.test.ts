// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { anything, reset, verify, when } from 'ts-mockito';
import { Disposable, Uri } from 'vscode';
import { mockedVSCodeNamespaces } from '../vscode-mock';
import { RecommendedEnvironmentService } from '../../client/interpreter/configuration/recommededEnvironmentService';

suite('RecommendedEnvironmentService - activate', () => {
    let service: RecommendedEnvironmentService;
    let subscriptions: Disposable[];

    setup(() => {
        subscriptions = [];
        const extensionContext = {
            subscriptions,
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve(),
            },
        } as any;

        when(mockedVSCodeNamespaces.commands!.registerCommand(anything(), anything())).thenReturn({
            dispose: () => {},
        } as Disposable);

        service = new RecommendedEnvironmentService(extensionContext);
    });

    teardown(() => {
        reset(mockedVSCodeNamespaces.commands!);
    });

    test('Multiroot workspace: command is registered only once across multiple activate calls', async () => {
        // Simulate multiroot workspace where activate is called once per workspace root
        const workspaceRoot1 = Uri.file('/workspace/root1');
        const workspaceRoot2 = Uri.file('/workspace/root2');
        const workspaceRoot3 = Uri.file('/workspace/root3');

        await service.activate(workspaceRoot1);
        await service.activate(workspaceRoot2);
        await service.activate(workspaceRoot3);

        verify(mockedVSCodeNamespaces.commands!.registerCommand('python.getRecommendedEnvironment', anything())).once();
        expect(subscriptions).to.have.lengthOf(1);
    });
});

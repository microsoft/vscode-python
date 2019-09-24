// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as TypeMoq from 'typemoq';
import { Extension } from 'vscode';
import { ICommandManager } from '../../client/common/application/types';
import { CODE_RUNNER_EXTENSION_ID } from '../../client/common/constants';
import { IExtensions } from '../../client/common/types';
import { IServiceContainer } from '../../client/ioc/types';
import {
    ExtensionActivationForTerminalActivation
} from '../../client/terminals/activation';

suite('Terminal - Activation', () => {
    let commands: TypeMoq.IMock<ICommandManager>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let extensions: TypeMoq.IMock<IExtensions>;
    let activation: ExtensionActivationForTerminalActivation;
    setup(() => {
        commands = TypeMoq.Mock.ofType<ICommandManager>(undefined, TypeMoq.MockBehavior.Strict);
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>(undefined, TypeMoq.MockBehavior.Strict);
        extensions = TypeMoq.Mock.ofType<IExtensions>(undefined, TypeMoq.MockBehavior.Strict);
        serviceContainer
            .setup(s => s.get<IExtensions>(IExtensions))
            .returns(() => extensions.object);
    });

    function verifyAll() {
        serviceContainer.verifyAll();
        commands.verifyAll();
        extensions.verifyAll();
    }

    test('If code runner extension is installed, don\'t show the play icon', async () => {
        // tslint:disable-next-line:no-any
        const extension = TypeMoq.Mock.ofType<Extension<any>>(undefined, TypeMoq.MockBehavior.Strict);
        extensions
            .setup(e => e.getExtension(CODE_RUNNER_EXTENSION_ID))
            .returns(() => extension.object)
            .verifiable(TypeMoq.Times.once());
        activation = new ExtensionActivationForTerminalActivation(
            commands.object,
            serviceContainer.object
        );

        commands
            .setup(c => c.executeCommand('setContext', 'python.showPlayIcon', true))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.never());

        await activation.activate();

        verifyAll();
    });

    test('If code runner extension is not installed, show the play icon', async () => {
        extensions
            .setup(e => e.getExtension(CODE_RUNNER_EXTENSION_ID))
            .returns(() => undefined)
            .verifiable(TypeMoq.Times.once());
        activation = new ExtensionActivationForTerminalActivation(
            commands.object,
            serviceContainer.object
        );

        commands
            .setup(c => c.executeCommand('setContext', 'python.showPlayIcon', true))
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());

        await activation.activate();
        verifyAll();
    });
});

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as TypeMoq from 'typemoq';
import { Terminal } from 'vscode';
import { TerminalActivator } from '../../../../client/common/terminal/activator';
import {
    ITerminalActivationHandler,
    ITerminalActivator,
    ITerminalHelper
} from '../../../../client/common/terminal/types';

// tslint:disable-next-line:max-func-body-length
suite('Terminal Activator', () => {
    let activator: TerminalActivator;
    let baseActivator: TypeMoq.IMock<ITerminalActivator>;
    let handler1: TypeMoq.IMock<ITerminalActivationHandler>;
    let handler2: TypeMoq.IMock<ITerminalActivationHandler>;

    setup(() => {
        baseActivator = TypeMoq.Mock.ofType<ITerminalActivator>();
        handler1 = TypeMoq.Mock.ofType<ITerminalActivationHandler>();
        handler2 = TypeMoq.Mock.ofType<ITerminalActivationHandler>();
        activator = new (class extends TerminalActivator {
            protected initialize() {
                this.baseActivator = baseActivator.object;
            }
        })(TypeMoq.Mock.ofType<ITerminalHelper>().object, [handler1.object, handler2.object]);
    });
    async function testActivationAndHandlers(activationSuccessful: boolean) {
        baseActivator
            .setup(b => b.activateEnvironmentInTerminal(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .returns(() => Promise.resolve(activationSuccessful))
            .verifiable(TypeMoq.Times.once());
        handler1
            .setup(h =>
                h.handleActivation(
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isValue(activationSuccessful)
                )
            )
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());
        handler2
            .setup(h =>
                h.handleActivation(
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isValue(activationSuccessful)
                )
            )
            .returns(() => Promise.resolve())
            .verifiable(TypeMoq.Times.once());

        const terminal = TypeMoq.Mock.ofType<Terminal>();
        await activator.activateEnvironmentInTerminal(terminal.object, { preserveFocus: activationSuccessful });

        baseActivator.verifyAll();
        handler1.verifyAll();
        handler2.verifyAll();
    }
    test('Terminal is activated and handlers are invoked', () => testActivationAndHandlers(true));
    test('Terminal is not activated and handlers are invoked', () => testActivationAndHandlers(false));
});

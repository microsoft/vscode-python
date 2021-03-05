// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as typemoq from 'typemoq';
import { IServiceManager } from '../../client/ioc/types';
import { TerminalAutoActivation } from '../../client/terminals/activation';
import { CodeExecutionManager } from '../../client/terminals/codeExecution/codeExecutionManager';
import { DjangoShellCodeExecutionProvider } from '../../client/terminals/codeExecution/djangoShellCodeExecution';
import { CodeExecutionHelper } from '../../client/terminals/codeExecution/helper';
import { ReplProvider } from '../../client/terminals/codeExecution/repl';
import { TerminalCodeExecutionProvider } from '../../client/terminals/codeExecution/terminalCodeExecution';
import { registerTypes } from '../../client/terminals/serviceRegistry';
import {
    ICodeExecutionHelper,
    ICodeExecutionManager,
    ICodeExecutionService,
    ITerminalAutoActivation,
} from '../../client/terminals/types';

suite('Terminal - Service Registry', () => {
    test('Ensure all services get registered', () => {
        const services = typemoq.Mock.ofType<IServiceManager>(undefined, typemoq.MockBehavior.Strict);
        [
            [ICodeExecutionHelper, CodeExecutionHelper],
            [ICodeExecutionManager, CodeExecutionManager],
            [ICodeExecutionService, DjangoShellCodeExecutionProvider, 'djangoShell'],
            [ICodeExecutionService, ReplProvider, 'repl'],
            [ITerminalAutoActivation, TerminalAutoActivation],
            [ICodeExecutionService, TerminalCodeExecutionProvider, 'standard'],
        ].forEach((args) => {
            if (args.length === 2) {
                services
                    .setup((s) =>
                        s.addSingleton(
                            typemoq.It.isValue(args[0] as any),
                            typemoq.It.is((value) => args[1] === value),
                        ),
                    )
                    .verifiable(typemoq.Times.once());
            } else {
                services
                    .setup((s) =>
                        s.addSingleton(
                            typemoq.It.isValue(args[0] as any),
                            typemoq.It.is((value) => args[1] === value),

                            typemoq.It.isValue(args[2] as any),
                        ),
                    )
                    .verifiable(typemoq.Times.once());
            }
        });

        registerTypes(services.object);

        services.verifyAll();
    });
});

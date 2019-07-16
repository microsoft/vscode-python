// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import { interfaces } from 'inversify';
import { IExtensionActivationService } from '../../client/activation/types';
import { ClassType } from '../../client/ioc/types';
import { ExtensionActivationForTerminalActivation, TerminalAutoActivation } from '../../client/terminals/activation';
import { CodeExecutionManager } from '../../client/terminals/codeExecution/codeExecutionManager';
import { DjangoShellCodeExecutionProvider } from '../../client/terminals/codeExecution/djangoShellCodeExecution';
import { CodeExecutionHelper } from '../../client/terminals/codeExecution/helper';
import { ReplProvider } from '../../client/terminals/codeExecution/repl';
import { TerminalCodeExecutionProvider } from '../../client/terminals/codeExecution/terminalCodeExecution';
import { registerTypes } from '../../client/terminals/serviceRegistry';
import {
    ICodeExecutionHelper, ICodeExecutionManager, ICodeExecutionService,
    ITerminalAutoActivation
} from '../../client/terminals/types';

suite('Terminal - Service Registry', () => {
    test('Ensure all services get registered', () => {
        // tslint:disable-next-line:no-use-before-declare
        const stub = new StubRegistry();

        registerTypes(stub);

        expect(stub.sort()).to.deep.equal([
            [ICodeExecutionHelper, CodeExecutionHelper, undefined],
            [ICodeExecutionManager, CodeExecutionManager, undefined],
            [ICodeExecutionService, DjangoShellCodeExecutionProvider, 'djangoShell'],
            [IExtensionActivationService, ExtensionActivationForTerminalActivation, undefined],
            [ICodeExecutionService, ReplProvider, 'repl'],
            [ITerminalAutoActivation, TerminalAutoActivation, undefined],
            [ICodeExecutionService, TerminalCodeExecutionProvider, 'standard']
        ], 'wrong services registered');
    });
});

class StubRegistry {
    // tslint:disable-next-line:no-any
    private registered: [any, any, any][];
    constructor() {
        this.registered = [];
    }
    public addSingleton<T>(
        svc: interfaces.ServiceIdentifier<T>,
        ctor: ClassType<T>,
        name?: string | number | symbol
    ): void {
        this.registered.push([svc, ctor, name]);
    }

    // tslint:disable-next-line:no-any
    public sort(): [any, any, any][] {
        return this.registered.sort((r1, r2) => {
            const c1 = r1[1];
            const c2 = r2[1];
            if (c1 > c2) {
                return 1;
            }
            if (c1 < c2) {
                return -1;
            }
            return 0;
        });
    }
}

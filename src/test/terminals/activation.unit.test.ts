// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { ICommandManager } from '../../client/common/application/types';
import { IExperimentsManager } from '../../client/common/types';
import {
    ExtensionActivationForTerminalActivation
} from '../../client/terminals/activation';

suite('Terminal - Activation', () => {
    let experiments: TypeMoq.IMock<IExperimentsManager>;
    let commands: TypeMoq.IMock<ICommandManager>;

    setup(() => {
        experiments = TypeMoq.Mock.ofType<IExperimentsManager>(undefined, TypeMoq.MockBehavior.Strict);
        commands = TypeMoq.Mock.ofType<ICommandManager>(undefined, TypeMoq.MockBehavior.Strict);
    });
    function verifyAll() {
        experiments.verifyAll();
        commands.verifyAll();
    }

    test('ExtensionActivationForTerminalActivation.activate() calls checkExperiments()', async () => {
        let called = false;
        function check() {
            // tslint:disable-next-line:no-unused-expression chai-vague-errors
            expect(called).to.be.false;
            called = true;
        }
        const activation = new ExtensionActivationForTerminalActivation(
            experiments.object,
            commands.object,
            check
        );

        await activation.activate(undefined);

        // tslint:disable-next-line:no-unused-expression chai-vague-errors
        expect(called).to.be.true;
        verifyAll();
    });
});

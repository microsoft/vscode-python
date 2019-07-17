// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { ICommandManager } from '../../client/common/application/types';
import { ShowPlayIcon } from '../../client/common/experimentGroups';
import { IExperimentsManager } from '../../client/common/types';
import { noop } from '../../client/common/utils/misc';
import {
    checkExperiments, ExtensionActivationForTerminalActivation
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

    // checkExperiments

    test('checkExperiments() - default', () => {
        experiments.setup(e => e.inExperiment(ShowPlayIcon.icon1))
            .returns(() => false)
            .verifiable(TypeMoq.Times.once());
        experiments.setup(e => e.inExperiment(ShowPlayIcon.icon2))
            .returns(() => false)
            .verifiable(TypeMoq.Times.once());
        experiments.setup(e => e.sendTelemetryIfInExperiment(ShowPlayIcon.control))
            .verifiable(TypeMoq.Times.once());

        checkExperiments(experiments.object, commands.object);

        verifyAll();
    });

    test('checkExperiments() - icon 1', () => {
        experiments.setup(e => e.inExperiment(ShowPlayIcon.icon1))
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        const cmdResult = TypeMoq.Mock.ofType<Thenable<undefined>>(undefined, TypeMoq.MockBehavior.Strict);
        cmdResult.setup(c => c.then(noop, noop))
            .verifiable(TypeMoq.Times.once());
        commands.setup(c => c.executeCommand('setContext', 'python.showPlayIcon1', true))
            .returns(() => cmdResult.object)
            .verifiable(TypeMoq.Times.once());

        checkExperiments(experiments.object, commands.object);

        verifyAll();
    });

    test('checkExperiments() - icon 2', () => {
        experiments.setup(e => e.inExperiment(ShowPlayIcon.icon1))
            .returns(() => false)
            .verifiable(TypeMoq.Times.once());
        experiments.setup(e => e.inExperiment(ShowPlayIcon.icon2))
            .returns(() => true)
            .verifiable(TypeMoq.Times.once());
        const cmdResult = TypeMoq.Mock.ofType<Thenable<undefined>>(undefined, TypeMoq.MockBehavior.Strict);
        cmdResult.setup(c => c.then(noop, noop))
            .verifiable(TypeMoq.Times.once());
        commands.setup(c => c.executeCommand('setContext', 'python.showPlayIcon2', true))
            .returns(() => cmdResult.object)
            .verifiable(TypeMoq.Times.once());

        checkExperiments(experiments.object, commands.object);

        verifyAll();
    });
});

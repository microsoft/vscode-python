// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as TypeMoq from 'typemoq';
import { ICommandManager } from '../../client/common/application/types';
import { ShowPlayIcon } from '../../client/common/experimentGroups';
import { IExperimentsManager } from '../../client/common/types';
import { noop } from '../../client/common/utils/misc';
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
        const activation = new ExtensionActivationForTerminalActivation(
            experiments.object,
            commands.object
        );

        activation.checkExperiments();

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
        const activation = new ExtensionActivationForTerminalActivation(
            experiments.object,
            commands.object
        );

        activation.checkExperiments();

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
        const activation = new ExtensionActivationForTerminalActivation(
            experiments.object,
            commands.object
        );

        activation.checkExperiments();

        verifyAll();
    });
});

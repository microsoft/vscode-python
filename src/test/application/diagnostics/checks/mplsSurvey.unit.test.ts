// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { UIKind } from 'vscode';
import { BaseDiagnosticsService } from '../../../../client/application/diagnostics/base';
import {
    MPLSSurveyDiagnostic,
    MPLSSurveyDiagnosticService,
} from '../../../../client/application/diagnostics/checks/mplsSurvey';
import { CommandOption, IDiagnosticsCommandFactory } from '../../../../client/application/diagnostics/commands/types';
import { DiagnosticCodes } from '../../../../client/application/diagnostics/constants';
import { MessageCommandPrompt } from '../../../../client/application/diagnostics/promptHandler';
import {
    DiagnosticScope,
    IDiagnostic,
    IDiagnosticCommand,
    IDiagnosticFilterService,
    IDiagnosticHandlerService,
    IDiagnosticsService,
} from '../../../../client/application/diagnostics/types';
import { IApplicationEnvironment } from '../../../../client/common/application/types';
import { IPlatformService } from '../../../../client/common/platform/types';
import { ExtensionSurveyBanner } from '../../../../client/common/utils/localize';
import { OSType } from '../../../../client/common/utils/platform';
import { IServiceContainer } from '../../../../client/ioc/types';

suite('Application Diagnostics - MPLS survey', () => {
    let serviceContainer: typemoq.IMock<IServiceContainer>;
    let diagnosticService: IDiagnosticsService;
    let commandFactory: typemoq.IMock<IDiagnosticsCommandFactory>;
    let filterService: typemoq.IMock<IDiagnosticFilterService>;
    let messageHandler: typemoq.IMock<IDiagnosticHandlerService<MessageCommandPrompt>>;
    let appEnvironment: typemoq.IMock<IApplicationEnvironment>;
    let platformService: typemoq.IMock<IPlatformService>;

    setup(() => {
        serviceContainer = typemoq.Mock.ofType<IServiceContainer>();
        filterService = typemoq.Mock.ofType<IDiagnosticFilterService>();
        messageHandler = typemoq.Mock.ofType<IDiagnosticHandlerService<MessageCommandPrompt>>();
        appEnvironment = typemoq.Mock.ofType<IApplicationEnvironment>();
        platformService = typemoq.Mock.ofType<IPlatformService>();

        commandFactory = typemoq.Mock.ofType<IDiagnosticsCommandFactory>();
        serviceContainer
            .setup((s) => s.get(typemoq.It.isValue(IDiagnosticFilterService)))
            .returns(() => filterService.object);
        serviceContainer
            .setup((s) => s.get(typemoq.It.isValue(IDiagnosticsCommandFactory)))
            .returns(() => commandFactory.object);

        diagnosticService = new (class extends MPLSSurveyDiagnosticService {
            // eslint-disable-next-line class-methods-use-this
            public _clear() {
                while (BaseDiagnosticsService.handledDiagnosticCodeKeys.length > 0) {
                    BaseDiagnosticsService.handledDiagnosticCodeKeys.shift();
                }
            }
        })(serviceContainer.object, messageHandler.object, [], appEnvironment.object, platformService.object);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (diagnosticService as any)._clear();
    });

    test('Should diagnose survey', async () => {
        appEnvironment.setup((a) => a.uiKind).returns(() => UIKind.Desktop);
        const diagnostics = await diagnosticService.diagnose(undefined);

        expect(diagnostics).to.be.deep.equal([
            new MPLSSurveyDiagnostic(ExtensionSurveyBanner.mplsMessage(), undefined),
        ]);
    });

    test('Should not diagnose if in web UI', async () => {
        appEnvironment.setup((a) => a.uiKind).returns(() => UIKind.Web);

        const diagnostics = await diagnosticService.diagnose(undefined);

        expect(diagnostics).to.be.lengthOf(0);
    });

    test('Should display a prompt when handling the diagnostic code', async () => {
        const diagnostic = new MPLSSurveyDiagnostic(DiagnosticCodes.MPLSSurveyDiagnostic, undefined);
        let messagePrompt: MessageCommandPrompt | undefined;

        messageHandler
            .setup((f) => f.handle(typemoq.It.isValue(diagnostic), typemoq.It.isAny()))
            .callback((_d, prompt: MessageCommandPrompt) => {
                messagePrompt = prompt;
            })
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());

        const alwaysIgnoreCommand = typemoq.Mock.ofType<IDiagnosticCommand>();
        commandFactory
            .setup((f) =>
                f.createCommand(
                    typemoq.It.isAny(),
                    typemoq.It.isObjectWith<CommandOption<'ignore', DiagnosticScope>>({
                        type: 'ignore',
                        options: DiagnosticScope.Global,
                    }),
                ),
            )
            .returns(() => alwaysIgnoreCommand.object)
            .verifiable(typemoq.Times.once());

        alwaysIgnoreCommand.setup((c) => c.invoke()).verifiable(typemoq.Times.never());

        await diagnosticService.handle([diagnostic]);

        filterService.verifyAll();
        messageHandler.verifyAll();
        commandFactory.verifyAll();
        alwaysIgnoreCommand.verifyAll();

        expect(messagePrompt).to.not.be.equal(undefined);
        expect(messagePrompt!.onClose).to.be.equal(undefined, 'onClose was not undefined');
        expect(messagePrompt!.commandPrompts).to.be.lengthOf(3);

        expect(messagePrompt!.commandPrompts[0].prompt).to.be.equal(ExtensionSurveyBanner.bannerLabelYes());
        expect(messagePrompt!.commandPrompts[0].command).to.not.be.equal(undefined, 'Yes command was undefined');
        expect(messagePrompt!.commandPrompts[1].prompt).to.be.equal(ExtensionSurveyBanner.maybeLater());
        expect(messagePrompt!.commandPrompts[1].command).to.be.equal(undefined, 'Later command was not undefined');
        expect(messagePrompt!.commandPrompts[2].prompt).to.be.equal(ExtensionSurveyBanner.bannerLabelNo());
        expect(messagePrompt!.commandPrompts[2].command).to.be.equal(alwaysIgnoreCommand.object);
    });

    test('Should return empty diagnostics if the diagnostic code has been ignored', async () => {
        const diagnostic = new MPLSSurveyDiagnostic(DiagnosticCodes.MPLSSurveyDiagnostic, undefined);

        filterService
            .setup((f) => f.shouldIgnoreDiagnostic(typemoq.It.isValue(DiagnosticCodes.MPLSSurveyDiagnostic)))
            .returns(() => Promise.resolve(true))
            .verifiable(typemoq.Times.once());

        messageHandler.setup((f) => f.handle(typemoq.It.isAny(), typemoq.It.isAny())).verifiable(typemoq.Times.never());

        await diagnosticService.handle([diagnostic]);

        filterService.verifyAll();
        messageHandler.verifyAll();
    });

    test('MPLSSurveyDiagnosticService can handle MPLSSurveyDiagnostic diagnostics', async () => {
        const diagnostic = typemoq.Mock.ofType<IDiagnostic>();
        diagnostic
            .setup((d) => d.code)
            .returns(() => DiagnosticCodes.MPLSSurveyDiagnostic)
            .verifiable(typemoq.Times.atLeastOnce());

        const canHandle = await diagnosticService.canHandle(diagnostic.object);

        expect(canHandle).to.be.equal(true, 'Invalid value');
        diagnostic.verifyAll();
    });

    test('MPLSSurveyDiagnosticService cannot handle non-MPLSSurveyDiagnostic diagnostics', async () => {
        const diagnostic = typemoq.Mock.ofType<IDiagnostic>();
        diagnostic
            .setup((d) => d.code)
            .returns(() => DiagnosticCodes.EnvironmentActivationInPowerShellWithBatchFilesNotSupportedDiagnostic)
            .verifiable(typemoq.Times.atLeastOnce());

        const canHandle = await diagnosticService.canHandle(diagnostic.object);

        expect(canHandle).to.be.equal(false, 'Invalid value');
        diagnostic.verifyAll();
    });

    test('Should open brower with info on yes', async () => {
        const diagnostic = new MPLSSurveyDiagnostic(DiagnosticCodes.MPLSSurveyDiagnostic, undefined);
        let messagePrompt: MessageCommandPrompt | undefined;

        messageHandler
            .setup((f) => f.handle(typemoq.It.isValue(diagnostic), typemoq.It.isAny()))
            .callback((_d, prompt: MessageCommandPrompt) => {
                messagePrompt = prompt;
            })
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());

        const alwaysIgnoreCommand = typemoq.Mock.ofType<IDiagnosticCommand>();
        commandFactory
            .setup((f) =>
                f.createCommand(
                    typemoq.It.isAny(),
                    typemoq.It.isObjectWith<CommandOption<'ignore', DiagnosticScope>>({
                        type: 'ignore',
                        options: DiagnosticScope.Global,
                    }),
                ),
            )
            .returns(() => alwaysIgnoreCommand.object)
            .verifiable(typemoq.Times.once());

        alwaysIgnoreCommand
            .setup((c) => c.invoke())
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());

        platformService
            .setup((p) => p.osType)
            .returns(() => OSType.Linux)
            .verifiable(typemoq.Times.once());

        appEnvironment
            .setup((a) => a.vscodeVersion)
            .returns(() => '1.56.2')
            .verifiable(typemoq.Times.once());

        appEnvironment
            .setup((a) => a.packageJson)
            .returns(() => ({ version: '2021.6.0' }))
            .verifiable(typemoq.Times.once());

        appEnvironment
            .setup((a) => a.sessionId)
            .returns(() => 'session-id')
            .verifiable(typemoq.Times.once());

        const launchCommand = typemoq.Mock.ofType<IDiagnosticCommand>();
        commandFactory
            .setup((f) =>
                f.createCommand(
                    typemoq.It.isAny(),
                    typemoq.It.isObjectWith<CommandOption<'launch', string>>({
                        type: 'launch',
                        options: 'https://aka.ms/mpls-experience-survey?o=Linux&v=1.56.2&e=2021.6.0&m=session-id',
                    }),
                ),
            )
            .returns(() => launchCommand.object)
            .verifiable(typemoq.Times.once());

        launchCommand
            .setup((c) => c.invoke())
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());

        await diagnosticService.handle([diagnostic]);

        filterService.verifyAll();
        messageHandler.verifyAll();

        await messagePrompt!.commandPrompts[0].command!.invoke();

        platformService.verifyAll();
        appEnvironment.verifyAll();
        alwaysIgnoreCommand.verifyAll();
        launchCommand.verifyAll();
    });
});

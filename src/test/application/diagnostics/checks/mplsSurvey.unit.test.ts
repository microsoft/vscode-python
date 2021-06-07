// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { ExtensionContext } from 'vscode';
import { BaseDiagnosticsService } from '../../../../client/application/diagnostics/base';
import {
    MPLSSurveyDiagnostic,
    MPLSSurveyDiagnosticService,
    MPLS_SURVEY_MEMENTO,
} from '../../../../client/application/diagnostics/checks/mplsSurvey';
import { DiagnosticCodes } from '../../../../client/application/diagnostics/constants';
import { MessageCommandPrompt } from '../../../../client/application/diagnostics/promptHandler';
import {
    IDiagnostic,
    IDiagnosticFilterService,
    IDiagnosticHandlerService,
    IDiagnosticsService,
} from '../../../../client/application/diagnostics/types';
import { IApplicationEnvironment } from '../../../../client/common/application/types';
import { IPlatformService } from '../../../../client/common/platform/types';
import { IBrowserService, IExtensionContext } from '../../../../client/common/types';
import { ExtensionSurveyBanner } from '../../../../client/common/utils/localize';
import { OSType } from '../../../../client/common/utils/platform';
import { IServiceContainer } from '../../../../client/ioc/types';

suite('Application Diagnostics - MPLS survey', () => {
    let serviceContainer: typemoq.IMock<IServiceContainer>;
    let diagnosticService: IDiagnosticsService;
    let filterService: typemoq.IMock<IDiagnosticFilterService>;
    let messageHandler: typemoq.IMock<IDiagnosticHandlerService<MessageCommandPrompt>>;
    let context: typemoq.IMock<IExtensionContext>;
    let memento: typemoq.IMock<ExtensionContext['globalState']>;
    let appEnvironment: typemoq.IMock<IApplicationEnvironment>;
    let platformService: typemoq.IMock<IPlatformService>;
    let browserService: typemoq.IMock<IBrowserService>;

    setup(() => {
        serviceContainer = typemoq.Mock.ofType<IServiceContainer>();
        filterService = typemoq.Mock.ofType<IDiagnosticFilterService>();
        messageHandler = typemoq.Mock.ofType<IDiagnosticHandlerService<MessageCommandPrompt>>();
        context = typemoq.Mock.ofType<IExtensionContext>();
        memento = typemoq.Mock.ofType<ExtensionContext['globalState']>();
        appEnvironment = typemoq.Mock.ofType<IApplicationEnvironment>();
        platformService = typemoq.Mock.ofType<IPlatformService>();
        browserService = typemoq.Mock.ofType<IBrowserService>();

        serviceContainer
            .setup((s) => s.get(typemoq.It.isValue(IDiagnosticFilterService)))
            .returns(() => filterService.object);
        context.setup((c) => c.globalState).returns(() => memento.object);

        diagnosticService = new (class extends MPLSSurveyDiagnosticService {
            // eslint-disable-next-line class-methods-use-this
            public _clear() {
                while (BaseDiagnosticsService.handledDiagnosticCodeKeys.length > 0) {
                    BaseDiagnosticsService.handledDiagnosticCodeKeys.shift();
                }
            }
        })(
            serviceContainer.object,
            context.object,
            messageHandler.object,
            [],
            appEnvironment.object,
            platformService.object,
            browserService.object,
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (diagnosticService as any)._clear();
    });

    teardown(() => {
        context.reset();
        memento.reset();
    });

    test('Should display message the prompt has not been shown yet', async () => {
        memento.setup((m) => m.get(MPLS_SURVEY_MEMENTO)).returns(() => undefined);

        const diagnostics = await diagnosticService.diagnose(undefined);

        expect(diagnostics).to.be.deep.equal([
            new MPLSSurveyDiagnostic(ExtensionSurveyBanner.mplsMessage(), undefined),
        ]);
    });

    test('Should return empty diagnostics if the prompt has been shown before', async () => {
        memento.setup((m) => m.get(MPLS_SURVEY_MEMENTO)).returns(() => true);

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

        browserService.setup((b) => b.launch(typemoq.It.isAny())).verifiable(typemoq.Times.never());

        await diagnosticService.handle([diagnostic]);

        filterService.verifyAll();
        messageHandler.verifyAll();
        browserService.verifyAll();

        expect(messagePrompt).to.not.be.equal(undefined);
        expect(messagePrompt!.onClose).to.not.be.equal(undefined);
        expect(messagePrompt!.commandPrompts).to.be.lengthOf(3);

        expect(messagePrompt!.commandPrompts[0].prompt).to.be.equal(ExtensionSurveyBanner.bannerLabelYes());
        expect(messagePrompt!.commandPrompts[0].command).to.not.be.equal(undefined);
        expect(messagePrompt!.commandPrompts[1].prompt).to.be.equal(ExtensionSurveyBanner.maybeLater());
        expect(messagePrompt!.commandPrompts[1].command).to.not.be.equal(undefined);
        expect(messagePrompt!.commandPrompts[2].prompt).to.be.equal(ExtensionSurveyBanner.bannerLabelNo());
        expect(messagePrompt!.commandPrompts[2].command).to.not.be.equal(undefined);
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

        await diagnosticService.handle([diagnostic]);

        filterService.verifyAll();
        messageHandler.verifyAll();

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

        memento
            .setup((m) => m.update(MPLS_SURVEY_MEMENTO, true))
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());

        browserService
            .setup((b) =>
                b.launch(
                    typemoq.It.isValue(
                        'https://aka.ms/mpls-experience-survey?o=Linux&v=1.56.2&e=2021.6.0&m=session-id',
                    ),
                ),
            )
            .verifiable(typemoq.Times.once());

        await messagePrompt!.commandPrompts[0].command!.invoke();

        platformService.verifyAll();
        appEnvironment.verifyAll();
        browserService.verifyAll();
        memento.verifyAll();
    });

    test('Should do nothing on later', async () => {
        const diagnostic = new MPLSSurveyDiagnostic(DiagnosticCodes.MPLSSurveyDiagnostic, undefined);
        let messagePrompt: MessageCommandPrompt | undefined;

        messageHandler
            .setup((f) => f.handle(typemoq.It.isValue(diagnostic), typemoq.It.isAny()))
            .callback((_d, prompt: MessageCommandPrompt) => {
                messagePrompt = prompt;
            })
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());

        await diagnosticService.handle([diagnostic]);

        filterService.verifyAll();
        messageHandler.verifyAll();

        browserService.setup((b) => b.launch(typemoq.It.isAny())).verifiable(typemoq.Times.never());
        memento.setup((m) => m.update(typemoq.It.isAny(), typemoq.It.isAny())).verifiable(typemoq.Times.never());

        await messagePrompt!.commandPrompts[1].command!.invoke();

        platformService.verifyAll();
        appEnvironment.verifyAll();
        browserService.verifyAll();
        memento.verifyAll();
    });

    test('Should do nothing on close', async () => {
        const diagnostic = new MPLSSurveyDiagnostic(DiagnosticCodes.MPLSSurveyDiagnostic, undefined);
        let messagePrompt: MessageCommandPrompt | undefined;

        messageHandler
            .setup((f) => f.handle(typemoq.It.isValue(diagnostic), typemoq.It.isAny()))
            .callback((_d, prompt: MessageCommandPrompt) => {
                messagePrompt = prompt;
            })
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());

        await diagnosticService.handle([diagnostic]);

        filterService.verifyAll();
        messageHandler.verifyAll();

        browserService.setup((b) => b.launch(typemoq.It.isAny())).verifiable(typemoq.Times.never());
        memento.setup((m) => m.update(typemoq.It.isAny(), typemoq.It.isAny())).verifiable(typemoq.Times.never());

        messagePrompt!.onClose!();

        platformService.verifyAll();
        appEnvironment.verifyAll();
        browserService.verifyAll();
        memento.verifyAll();
    });

    test('Should update memento and not open browser on no', async () => {
        const diagnostic = new MPLSSurveyDiagnostic(DiagnosticCodes.MPLSSurveyDiagnostic, undefined);
        let messagePrompt: MessageCommandPrompt | undefined;

        messageHandler
            .setup((f) => f.handle(typemoq.It.isValue(diagnostic), typemoq.It.isAny()))
            .callback((_d, prompt: MessageCommandPrompt) => {
                messagePrompt = prompt;
            })
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());

        await diagnosticService.handle([diagnostic]);

        filterService.verifyAll();
        messageHandler.verifyAll();

        browserService.setup((b) => b.launch(typemoq.It.isAny())).verifiable(typemoq.Times.never());

        memento
            .setup((m) => m.update(MPLS_SURVEY_MEMENTO, true))
            .returns(() => Promise.resolve())
            .verifiable(typemoq.Times.once());

        await messagePrompt!.commandPrompts[2].command!.invoke();

        platformService.verifyAll();
        appEnvironment.verifyAll();
        browserService.verifyAll();
        memento.verifyAll();
    });
});

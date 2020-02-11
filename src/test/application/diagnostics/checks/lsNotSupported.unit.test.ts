// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { ILanguageServerCompatibilityService } from '../../../../client/activation/types';
import { BaseDiagnosticsService } from '../../../../client/application/diagnostics/base';
import { LSNotSupportedDiagnosticService } from '../../../../client/application/diagnostics/checks/lsNotSupported';
import { CommandOption, IDiagnosticsCommandFactory } from '../../../../client/application/diagnostics/commands/types';
import { DiagnosticCodes } from '../../../../client/application/diagnostics/constants';
import {
    DiagnosticCommandPromptHandlerServiceId,
    MessageCommandPrompt
} from '../../../../client/application/diagnostics/promptHandler';
import {
    DiagnosticScope,
    IDiagnostic,
    IDiagnosticCommand,
    IDiagnosticFilterService,
    IDiagnosticHandlerService,
    IDiagnosticsService
} from '../../../../client/application/diagnostics/types';
import { IWorkspaceService } from '../../../../client/common/application/types';
import { IServiceContainer } from '../../../../client/ioc/types';

// tslint:disable:max-func-body-length no-any
suite('Application Diagnostics - Checks LS not supported', () => {
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let diagnosticService: IDiagnosticsService;
    let filterService: TypeMoq.IMock<IDiagnosticFilterService>;
    let commandFactory: TypeMoq.IMock<IDiagnosticsCommandFactory>;
    let messageHandler: TypeMoq.IMock<IDiagnosticHandlerService<MessageCommandPrompt>>;
    let lsCompatibility: TypeMoq.IMock<ILanguageServerCompatibilityService>;
    setup(() => {
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        filterService = TypeMoq.Mock.ofType<IDiagnosticFilterService>();
        commandFactory = TypeMoq.Mock.ofType<IDiagnosticsCommandFactory>();
        messageHandler = TypeMoq.Mock.ofType<IDiagnosticHandlerService<MessageCommandPrompt>>();
        lsCompatibility = TypeMoq.Mock.ofType<ILanguageServerCompatibilityService>();
        serviceContainer
            .setup(s => s.get(TypeMoq.It.isValue(IDiagnosticFilterService)))
            .returns(() => filterService.object);
        serviceContainer
            .setup(s => s.get(TypeMoq.It.isValue(IDiagnosticsCommandFactory)))
            .returns(() => commandFactory.object);
        serviceContainer
            .setup(s =>
                s.get(
                    TypeMoq.It.isValue(IDiagnosticHandlerService),
                    TypeMoq.It.isValue(DiagnosticCommandPromptHandlerServiceId)
                )
            )
            .returns(() => messageHandler.object);
        const workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        serviceContainer
            .setup(s => s.get(TypeMoq.It.isValue(IWorkspaceService)))
            .returns(() => workspaceService.object);
        workspaceService.setup(w => w.getWorkspaceFolder(TypeMoq.It.isAny())).returns(() => undefined);

        diagnosticService = new (class extends LSNotSupportedDiagnosticService {
            public _clear() {
                while (BaseDiagnosticsService.handledDiagnosticCodeKeys.length > 0) {
                    BaseDiagnosticsService.handledDiagnosticCodeKeys.shift();
                }
            }
        })(serviceContainer.object, lsCompatibility.object, messageHandler.object, []);
        (diagnosticService as any)._clear();
    });

    test('Should display two options in message displayed with 2 commands', async () => {
        let options: MessageCommandPrompt | undefined;
        const diagnostic = TypeMoq.Mock.ofType<IDiagnostic>();
        diagnostic
            .setup(d => d.code)
            .returns(() => DiagnosticCodes.LSNotSupportedDiagnostic)
            .verifiable(TypeMoq.Times.atLeastOnce());
        const launchBrowserCommand = TypeMoq.Mock.ofType<IDiagnosticCommand>();
        commandFactory
            .setup(f =>
                f.createCommand(
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isObjectWith<CommandOption<'launch', string>>({ type: 'launch' })
                )
            )
            .returns(() => launchBrowserCommand.object)
            .verifiable(TypeMoq.Times.once());
        const alwaysIgnoreCommand = TypeMoq.Mock.ofType<IDiagnosticCommand>();
        commandFactory
            .setup(f =>
                f.createCommand(
                    TypeMoq.It.isAny(),
                    TypeMoq.It.isObjectWith<CommandOption<'ignore', DiagnosticScope>>({
                        type: 'ignore',
                        options: DiagnosticScope.Global
                    })
                )
            )
            .returns(() => alwaysIgnoreCommand.object)
            .verifiable(TypeMoq.Times.once());
        messageHandler
            .setup(m => m.handle(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .callback((_, opts: MessageCommandPrompt) => (options = opts))
            .verifiable(TypeMoq.Times.once());

        await diagnosticService.handle([diagnostic.object]);

        diagnostic.verifyAll();
        commandFactory.verifyAll();
        messageHandler.verifyAll();
        expect(options!.commandPrompts).to.be.lengthOf(2);
        expect(options!.commandPrompts[0].prompt).to.be.equal('More Info');
    });
    test('Should not display a message if the diagnostic code has been ignored', async () => {
        const diagnostic = TypeMoq.Mock.ofType<IDiagnostic>();

        filterService
            .setup(f => f.shouldIgnoreDiagnostic(TypeMoq.It.isValue(DiagnosticCodes.LSNotSupportedDiagnostic)))
            .returns(() => Promise.resolve(true))
            .verifiable(TypeMoq.Times.once());
        diagnostic
            .setup(d => d.code)
            .returns(() => DiagnosticCodes.LSNotSupportedDiagnostic)
            .verifiable(TypeMoq.Times.atLeastOnce());
        commandFactory
            .setup(f => f.createCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
            .verifiable(TypeMoq.Times.never());
        messageHandler.setup(m => m.handle(TypeMoq.It.isAny(), TypeMoq.It.isAny())).verifiable(TypeMoq.Times.never());

        await diagnosticService.handle([diagnostic.object]);

        filterService.verifyAll();
        diagnostic.verifyAll();
        commandFactory.verifyAll();
        messageHandler.verifyAll();
    });

    test('LSNotSupportedDiagnosticService can handle LSNotSupported diagnostics', async () => {
        const diagnostic = TypeMoq.Mock.ofType<IDiagnostic>();
        diagnostic
            .setup(d => d.code)
            .returns(() => DiagnosticCodes.LSNotSupportedDiagnostic)
            .verifiable(TypeMoq.Times.atLeastOnce());
        const canHandle = await diagnosticService.canHandle(diagnostic.object);
        expect(canHandle).to.be.equal(true, 'Invalid value');
        diagnostic.verifyAll();
    });
    test('LSNotSupportedDiagnosticService can not handle non-LSNotSupported diagnostics', async () => {
        const diagnostic = TypeMoq.Mock.ofType<IDiagnostic>();
        diagnostic
            .setup(d => d.code)
            .returns(() => 'Something Else' as any)
            .verifiable(TypeMoq.Times.atLeastOnce());
        const canHandle = await diagnosticService.canHandle(diagnostic.object);
        expect(canHandle).to.be.equal(false, 'Invalid value');
        diagnostic.verifyAll();
    });
});

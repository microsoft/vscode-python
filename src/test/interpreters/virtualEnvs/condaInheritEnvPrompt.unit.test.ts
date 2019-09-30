// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { Uri, WorkspaceConfiguration } from 'vscode';
import { IApplicationShell, IWorkspaceService } from '../../../client/common/application/types';
import { PersistentStateFactory } from '../../../client/common/persistentState';
import { IPersistentStateFactory } from '../../../client/common/types';
import { IInterpreterService, InterpreterType } from '../../../client/interpreter/contracts';
import { CondaInheritEnvPrompt } from '../../../client/interpreter/virtualEnvs/condaInheritEnvPrompt';

// tslint:disable:no-any

// tslint:disable-next-line:max-func-body-length
suite('Conda Inherit Env Prompt', async () => {
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let appShell: TypeMoq.IMock<IApplicationShell>;
    let interpreterService: TypeMoq.IMock<IInterpreterService>;
    let persistentStateFactory: IPersistentStateFactory;
    let condaInheritEnvPrompt: CondaInheritEnvPrompt;
    function verifyAll() {
        workspaceService.verifyAll();
        appShell.verifyAll();
        interpreterService.verifyAll();
    }
    suite('Method shouldShowPrompt()', () => {
        setup(() => {
            workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
            appShell = TypeMoq.Mock.ofType<IApplicationShell>();
            interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
            persistentStateFactory = mock(PersistentStateFactory);
            condaInheritEnvPrompt = new CondaInheritEnvPrompt(interpreterService.object, workspaceService.object, appShell.object, instance(persistentStateFactory));
        });
        test('Returns true otherwise', async () => {
            const interpreter = {
                type: InterpreterType.Pipenv
            };
            const settings = {
                globalValue: undefined,
                workspaceValue: undefined,
                workspaceFolderValue: undefined
            };
            const workspaceConfig = TypeMoq.Mock.ofType<WorkspaceConfiguration>();
            const resource = Uri.file('a');
            interpreterService
                .setup(is => is.getActiveInterpreter(resource))
                .returns(() => interpreter as any)
                .verifiable(TypeMoq.Times.once());
            workspaceService
                .setup(ws => ws.getConfiguration('terminal', resource))
                .returns(() => workspaceConfig.object)
                .verifiable(TypeMoq.Times.once());
            workspaceConfig
                .setup(ws => ws.inspect<boolean>('integrated.inheritEnv'))
                .returns(() => settings as any);
            const result = condaInheritEnvPrompt.shouldShowPrompt(resource);
            expect(result).to.equal(false, 'Prompt should not be shown');
        });
    });
});

// tslint:disable-next-line: max-func-body-length
// suite('Extension survey prompt - showSurvey()', () => {
//     let notificationPromptEnabled: TypeMoq.IMock<IPersistentState<any>>;
//     let experiments: TypeMoq.IMock<IExperimentsManager>;
//     let appShell: TypeMoq.IMock<IApplicationShell>;
//     let browserService: TypeMoq.IMock<IBrowserService>;
//     let random: TypeMoq.IMock<IRandom>;
//     let persistentStateFactory: IPersistentStateFactory;
//     let disableSurveyForTime: TypeMoq.IMock<IPersistentState<any>>;
//     let doNotShowAgain: TypeMoq.IMock<IPersistentState<any>>;
//     let extensionSurveyPrompt: ExtensionSurveyPrompt;
//     let notificationPromptEnabled: TypeMoq.IMock<IPersistentState<any>>;
//     setup(() => {
//         appShell = TypeMoq.Mock.ofType<IApplicationShell>();
//         browserService = TypeMoq.Mock.ofType<IBrowserService>();
//         random = TypeMoq.Mock.ofType<IRandom>();
//         persistentStateFactory = mock(PersistentStateFactory);
//         disableSurveyForTime = TypeMoq.Mock.ofType<IPersistentState<any>>();
//         doNotShowAgain = TypeMoq.Mock.ofType<IPersistentState<any>>();
//         when(persistentStateFactory.createGlobalPersistentState(extensionSurveyStateKeys.disableSurveyForTime, false, anything())).thenReturn(disableSurveyForTime.object);
//         when(persistentStateFactory.createGlobalPersistentState(extensionSurveyStateKeys.doNotShowAgain, false)).thenReturn(doNotShowAgain.object);
//         experiments = TypeMoq.Mock.ofType<IExperimentsManager>();
//         extensionSurveyPrompt = new ExtensionSurveyPrompt(appShell.object, browserService.object, instance(persistentStateFactory), random.object, experiments.object, 10);
//     });

//     test('Launch survey if \'Yes\' option is clicked', async () => {
//         notificationPromptEnabled = TypeMoq.Mock.ofType<IPersistentState<any>>();
//         when(persistentStateFactory.createGlobalPersistentState(condaInheritEnvPromptKey, true)).thenReturn(notificationPromptEnabled.object);
//         const prompts = [LanguageService.bannerLabelYes(), ExtensionSurveyBanner.maybeLater(), Common.doNotShowAgain()];
//         appShell
//             .setup(a => a.showInformationMessage(ExtensionSurveyBanner.bannerMessage(), ...prompts))
//             .returns(() => Promise.resolve(LanguageService.bannerLabelYes()))
//             .verifiable(TypeMoq.Times.once());
//         browserService
//             .setup(s => s.launch(TypeMoq.It.isAny()))
//             .returns(() => Promise.resolve())
//             .verifiable(TypeMoq.Times.once());
//         disableSurveyForTime
//             .setup(d => d.updateValue(true))
//             .returns(() => Promise.resolve())
//             .verifiable(TypeMoq.Times.once());
//         doNotShowAgain
//             .setup(d => d.updateValue(true))
//             .returns(() => Promise.resolve())
//             .verifiable(TypeMoq.Times.never());
//         await extensionSurveyPrompt.showSurvey();
//         verify(persistentStateFactory.createGlobalPersistentState(extensionSurveyStateKeys.disableSurveyForTime, false, anything())).once();
//         verify(persistentStateFactory.createGlobalPersistentState(extensionSurveyStateKeys.doNotShowAgain, false)).never();
//         appShell.verifyAll();
//         browserService.verifyAll();
//         disableSurveyForTime.verifyAll();
//         doNotShowAgain.verifyAll();
//     });

//     test('Do nothing if \'Maybe later\' option is clicked', async () => {
//         const prompts = [LanguageService.bannerLabelYes(), ExtensionSurveyBanner.maybeLater(), Common.doNotShowAgain()];
//         appShell
//             .setup(a => a.showInformationMessage(ExtensionSurveyBanner.bannerMessage(), ...prompts))
//             .returns(() => Promise.resolve(ExtensionSurveyBanner.maybeLater()))
//             .verifiable(TypeMoq.Times.once());
//         browserService
//             .setup(s => s.launch(TypeMoq.It.isAny()))
//             .returns(() => Promise.resolve())
//             .verifiable(TypeMoq.Times.never());
//         disableSurveyForTime
//             .setup(d => d.updateValue(true))
//             .returns(() => Promise.resolve())
//             .verifiable(TypeMoq.Times.never());
//         doNotShowAgain
//             .setup(d => d.updateValue(true))
//             .returns(() => Promise.resolve())
//             .verifiable(TypeMoq.Times.never());
//         await extensionSurveyPrompt.showSurvey();
//         verify(persistentStateFactory.createGlobalPersistentState(extensionSurveyStateKeys.disableSurveyForTime, false, anything())).never();
//         verify(persistentStateFactory.createGlobalPersistentState(extensionSurveyStateKeys.doNotShowAgain, false)).never();
//         appShell.verifyAll();
//         browserService.verifyAll();
//         disableSurveyForTime.verifyAll();
//         doNotShowAgain.verifyAll();
//     });

//     test('Do nothing if no option is clicked', async () => {
//         const prompts = [LanguageService.bannerLabelYes(), ExtensionSurveyBanner.maybeLater(), Common.doNotShowAgain()];
//         appShell
//             .setup(a => a.showInformationMessage(ExtensionSurveyBanner.bannerMessage(), ...prompts))
//             .returns(() => Promise.resolve(undefined))
//             .verifiable(TypeMoq.Times.once());
//         browserService
//             .setup(s => s.launch(TypeMoq.It.isAny()))
//             .returns(() => Promise.resolve())
//             .verifiable(TypeMoq.Times.never());
//         disableSurveyForTime
//             .setup(d => d.updateValue(true))
//             .returns(() => Promise.resolve())
//             .verifiable(TypeMoq.Times.never());
//         doNotShowAgain
//             .setup(d => d.updateValue(true))
//             .returns(() => Promise.resolve())
//             .verifiable(TypeMoq.Times.never());
//         await extensionSurveyPrompt.showSurvey();
//         verify(persistentStateFactory.createGlobalPersistentState(extensionSurveyStateKeys.disableSurveyForTime, false, anything())).never();
//         verify(persistentStateFactory.createGlobalPersistentState(extensionSurveyStateKeys.doNotShowAgain, false)).never();
//         appShell.verifyAll();
//         browserService.verifyAll();
//         disableSurveyForTime.verifyAll();
//         doNotShowAgain.verifyAll();
//     });

//     test('Disable prompt if \'Do not show again\' option is clicked', async () => {
//         const prompts = [LanguageService.bannerLabelYes(), ExtensionSurveyBanner.maybeLater(), Common.doNotShowAgain()];
//         appShell
//             .setup(a => a.showInformationMessage(ExtensionSurveyBanner.bannerMessage(), ...prompts))
//             .returns(() => Promise.resolve(Common.doNotShowAgain()))
//             .verifiable(TypeMoq.Times.once());
//         browserService
//             .setup(s => s.launch(TypeMoq.It.isAny()))
//             .returns(() => Promise.resolve())
//             .verifiable(TypeMoq.Times.never());
//         disableSurveyForTime
//             .setup(d => d.updateValue(true))
//             .returns(() => Promise.resolve())
//             .verifiable(TypeMoq.Times.never());
//         doNotShowAgain
//             .setup(d => d.updateValue(true))
//             .returns(() => Promise.resolve())
//             .verifiable(TypeMoq.Times.once());
//         await extensionSurveyPrompt.showSurvey();
//         verify(persistentStateFactory.createGlobalPersistentState(extensionSurveyStateKeys.disableSurveyForTime, false, anything())).never();
//         verify(persistentStateFactory.createGlobalPersistentState(extensionSurveyStateKeys.doNotShowAgain, false)).once();
//         appShell.verifyAll();
//         browserService.verifyAll();
//         disableSurveyForTime.verifyAll();
//         doNotShowAgain.verifyAll();
//     });
// });

// // tslint:disable-next-line: max-func-body-length
// suite('Extension survey prompt - activate()', () => {
//     let appShell: TypeMoq.IMock<IApplicationShell>;
//     let browserService: TypeMoq.IMock<IBrowserService>;
//     let random: TypeMoq.IMock<IRandom>;
//     let persistentStateFactory: IPersistentStateFactory;
//     let shouldShowBanner: sinon.SinonStub<any>;
//     let showSurvey: sinon.SinonStub<any>;
//     let experiments: TypeMoq.IMock<IExperimentsManager>;
//     let extensionSurveyPrompt: ExtensionSurveyPrompt;
//     setup(() => {
//         appShell = TypeMoq.Mock.ofType<IApplicationShell>();
//         browserService = TypeMoq.Mock.ofType<IBrowserService>();
//         random = TypeMoq.Mock.ofType<IRandom>();
//         persistentStateFactory = mock(PersistentStateFactory);
//         experiments = TypeMoq.Mock.ofType<IExperimentsManager>();
//     });

//     teardown(() => {
//         sinon.restore();
//     });

//     test('If user is not in \'ShowExtensionPrompt\' experiment, send telemetry if in control group & return', async () => {
//         shouldShowBanner = sinon.stub(ExtensionSurveyPrompt.prototype, 'shouldShowBanner');
//         shouldShowBanner.callsFake(() => false);
//         showSurvey = sinon.stub(ExtensionSurveyPrompt.prototype, 'showSurvey');
//         extensionSurveyPrompt = new ExtensionSurveyPrompt(appShell.object, browserService.object, instance(persistentStateFactory), random.object, experiments.object, 10);
//         experiments
//             .setup(exp => exp.inExperiment(ShowExtensionSurveyPrompt.enabled))
//             .returns(() => false)
//             .verifiable(TypeMoq.Times.once());
//         experiments
//             .setup(exp => exp.sendTelemetryIfInExperiment(ShowExtensionSurveyPrompt.control))
//             .returns(() => undefined)
//             .verifiable(TypeMoq.Times.once());
//         await extensionSurveyPrompt.activate();
//         assert.ok(shouldShowBanner.notCalled);
//         experiments.verifyAll();
//     });

//     test('No survey is shown if shouldShowBanner() returns false and user is in \'ShowExtensionPrompt\' experiment', async () => {
//         const deferred = createDeferred<true>();
//         shouldShowBanner = sinon.stub(ExtensionSurveyPrompt.prototype, 'shouldShowBanner');
//         shouldShowBanner.callsFake(() => false);
//         showSurvey = sinon.stub(ExtensionSurveyPrompt.prototype, 'showSurvey');
//         showSurvey.callsFake(() => {
//             deferred.resolve(true);
//             return Promise.resolve();
//         });
//         // waitTimeToShowSurvey = 50 ms
//         extensionSurveyPrompt = new ExtensionSurveyPrompt(appShell.object, browserService.object, instance(persistentStateFactory), random.object, experiments.object, 10, 50);
//         experiments
//             .setup(exp => exp.inExperiment(ShowExtensionSurveyPrompt.enabled))
//             .returns(() => true)
//             .verifiable(TypeMoq.Times.once());
//         experiments
//             .setup(exp => exp.sendTelemetryIfInExperiment(TypeMoq.It.isAny()))
//             .returns(() => undefined)
//             .verifiable(TypeMoq.Times.never());
//         await extensionSurveyPrompt.activate();
//         assert.ok(shouldShowBanner.calledOnce);

//         const doesSurveyShowUp = await Promise.race([deferred.promise, sleep(100).then(() => false)]);
//         assert.ok(showSurvey.notCalled);
//         expect(doesSurveyShowUp).to.equal(false, 'Survey should not appear');
//         experiments.verifyAll();
//     });

//     test('Survey is shown after waitTimeToShowSurvey if shouldShowBanner() returns true and user is in \'ShowExtensionPrompt\' experiment', async () => {
//         const deferred = createDeferred<true>();
//         shouldShowBanner = sinon.stub(ExtensionSurveyPrompt.prototype, 'shouldShowBanner');
//         shouldShowBanner.callsFake(() => true);
//         showSurvey = sinon.stub(ExtensionSurveyPrompt.prototype, 'showSurvey');
//         showSurvey.callsFake(() => {
//             deferred.resolve(true);
//             return Promise.resolve();
//         });
//         // waitTimeToShowSurvey = 50 ms
//         extensionSurveyPrompt = new ExtensionSurveyPrompt(appShell.object, browserService.object, instance(persistentStateFactory), random.object, experiments.object, 10, 50);
//         experiments
//             .setup(exp => exp.inExperiment(ShowExtensionSurveyPrompt.enabled))
//             .returns(() => true)
//             .verifiable(TypeMoq.Times.once());
//         experiments
//             .setup(exp => exp.sendTelemetryIfInExperiment(TypeMoq.It.isAny()))
//             .returns(() => undefined)
//             .verifiable(TypeMoq.Times.never());
//         await extensionSurveyPrompt.activate();
//         assert.ok(shouldShowBanner.calledOnce);

//         const doesSurveyShowUp = await Promise.race([deferred.promise, sleep(200).then(() => false)]);
//         expect(doesSurveyShowUp).to.equal(true, 'Survey should appear');
//         assert.ok(showSurvey.calledOnce);
//         experiments.verifyAll();
//     });
// });

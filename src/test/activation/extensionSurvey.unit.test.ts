// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as sinon from 'sinon';
import { when } from 'ts-mockito';
import { UIKind, WorkspaceConfiguration } from 'vscode';
import { ExtensionSurveyPrompt, extensionSurveyStateKeys } from '../../client/activation/extensionSurvey';
import { IApplicationEnvironment, IApplicationShell, IWorkspaceService } from '../../client/common/application/types';
import { ShowExtensionSurveyPrompt } from '../../client/common/experiments/groups';
import { PersistentStateFactory } from '../../client/common/persistentState';
import { IPlatformService } from '../../client/common/platform/types';
import { IBrowserService, IExperimentService, IRandom } from '../../client/common/types';
import { Common, ExtensionSurveyBanner } from '../../client/common/utils/localize';
import { OSType } from '../../client/common/utils/platform';
import { MockMemento } from '../mocks/mementos';
import { MockWorkspaceConfiguration } from '../mocks/mockWorkspaceConfig';
import { mockedVSCodeNamespaces } from '../vscode-mock';

const TWELVE_WEEKS_MS = 1000 * 60 * 60 * 24 * 7 * 12;

interface SurveyPromptHarnessOptions {
    sampleSize?: number;
    waitTimeToShowSurvey?: number;
    inExperiment?: boolean;
    randomInt?: number;
    telemetryConfig?: WorkspaceConfiguration;
    hasTelemetryConfig?: boolean;
    showInformationMessageResult?: string;
}

function createSurveyPromptHarness(options: SurveyPromptHarnessOptions = {}) {
    const globalMemento = new MockMemento();
    const workspaceMemento = new MockMemento();
    const persistentStateFactory = new PersistentStateFactory(globalMemento, workspaceMemento);

    const showInformationMessageStub = sinon.stub().resolves(options.showInformationMessageResult);
    const appShell = ({
        showInformationMessage: showInformationMessageStub,
    } as unknown) as IApplicationShell;

    const browserLaunchStub = sinon.stub().resolves();
    const browserService = ({
        launch: browserLaunchStub,
    } as unknown) as IBrowserService;

    const getRandomIntStub = sinon.stub().returns(options.randomInt ?? 0);
    const random: IRandom = {
        getRandomInt: getRandomIntStub,
    };

    const inExperimentStub = sinon.stub().resolves(options.inExperiment ?? true);
    const experiments = ({
        inExperiment: inExperimentStub,
    } as unknown) as IExperimentService;

    const appEnvironment = ({
        vscodeVersion: 'vscodeVersion',
        packageJson: { version: 'extensionVersion' },
        sessionId: 'sessionId',
    } as unknown) as IApplicationEnvironment;

    const platformService = ({
        osType: OSType.Windows,
    } as unknown) as IPlatformService;

    const telemetryConfig =
        options.hasTelemetryConfig === false
            ? undefined
            : options.telemetryConfig ?? new MockWorkspaceConfiguration({ 'feedback.enabled': true });
    const workspaceService = ({
        getConfiguration: (section?: string) => (section === 'telemetry' ? telemetryConfig : undefined),
    } as unknown) as IWorkspaceService;

    const prompt = new ExtensionSurveyPrompt(
        appShell,
        browserService,
        persistentStateFactory,
        random,
        experiments,
        appEnvironment,
        platformService,
        workspaceService,
        options.sampleSize ?? 10,
        options.waitTimeToShowSurvey,
    );

    return {
        prompt,
        persistentStateFactory,
        globalMemento,
        showInformationMessageStub,
        browserLaunchStub,
        getRandomIntStub,
        inExperimentStub,
    };
}

suite('Extension survey prompt', () => {
    setup(() => {
        when(mockedVSCodeNamespaces.env!.uiKind).thenReturn(UIKind.Desktop);
    });

    teardown(() => {
        sinon.restore();
        when(mockedVSCodeNamespaces.env!.uiKind).thenReturn(UIKind.Desktop);
    });

    suite('shouldShowBanner()', () => {
        test('Returns false when running in Web UI', () => {
            when(mockedVSCodeNamespaces.env!.uiKind).thenReturn(UIKind.Web);
            const { prompt, getRandomIntStub } = createSurveyPromptHarness();

            expect(prompt.shouldShowBanner()).to.equal(false, 'Banner should not be shown on Web');
            sinon.assert.notCalled(getRandomIntStub);
        });

        test('Returns false if do not show again is set', async () => {
            const { prompt, persistentStateFactory, getRandomIntStub } = createSurveyPromptHarness();
            await persistentStateFactory
                .createGlobalPersistentState(extensionSurveyStateKeys.doNotShowAgain, false)
                .updateValue(true);

            expect(prompt.shouldShowBanner()).to.equal(false, 'Banner should not be shown');
            sinon.assert.notCalled(getRandomIntStub);
        });

        test('Returns false if prompt is disabled for a while, and true after expiry', async () => {
            const clock = sinon.useFakeTimers({ now: 1_000_000 });
            const { prompt, persistentStateFactory, getRandomIntStub } = createSurveyPromptHarness();
            await persistentStateFactory
                .createGlobalPersistentState(extensionSurveyStateKeys.disableSurveyForTime, false, TWELVE_WEEKS_MS)
                .updateValue(true);

            expect(prompt.shouldShowBanner()).to.equal(false, 'Banner should not be shown while disabled');
            sinon.assert.notCalled(getRandomIntStub);

            clock.tick(TWELVE_WEEKS_MS + 1);
            expect(prompt.shouldShowBanner()).to.equal(true, 'Banner should be eligible again after expiry');
            sinon.assert.calledOnce(getRandomIntStub);
        });

        test('Returns false if user is not in the random sampling', () => {
            const { prompt, getRandomIntStub } = createSurveyPromptHarness();

            // Default sample size is 10
            for (let i = 10; i < 100; i = i + 1) {
                getRandomIntStub.returns(i);
                expect(prompt.shouldShowBanner()).to.equal(false, 'Banner should not be shown');
            }
            sinon.assert.callCount(getRandomIntStub, 90);
        });

        test('Returns true if telemetry.feedback.enabled is enabled', () => {
            const { prompt } = createSurveyPromptHarness({
                telemetryConfig: new MockWorkspaceConfiguration({ 'feedback.enabled': true }),
            });

            expect(prompt.shouldShowBanner()).to.equal(
                true,
                'Banner should be shown when telemetry.feedback.enabled is true',
            );
        });

        test('Returns false if telemetry.feedback.enabled is disabled', () => {
            const { prompt, getRandomIntStub } = createSurveyPromptHarness({
                telemetryConfig: new MockWorkspaceConfiguration({ 'feedback.enabled': false }),
            });

            expect(prompt.shouldShowBanner()).to.equal(
                false,
                'Banner should not be shown when feedback.enabled is false',
            );
            sinon.assert.notCalled(getRandomIntStub);
        });

        test('Defaults feedback.enabled to true when setting or telemetry config is absent', () => {
            const unsetSetting = createSurveyPromptHarness({
                telemetryConfig: new MockWorkspaceConfiguration(),
            });
            const missingSection = createSurveyPromptHarness({
                hasTelemetryConfig: false,
            });

            expect(unsetSetting.prompt.shouldShowBanner()).to.equal(true);
            expect(missingSection.prompt.shouldShowBanner()).to.equal(true);
        });

        test('Returns true if user is in the random sampling', () => {
            const { prompt, getRandomIntStub } = createSurveyPromptHarness();

            // Default sample size is 10
            for (let i = 0; i < 10; i = i + 1) {
                getRandomIntStub.returns(i);
                expect(prompt.shouldShowBanner()).to.equal(true, 'Banner should be shown');
            }
        });

        test('Always returns true if sample size is 100', () => {
            const { prompt, getRandomIntStub } = createSurveyPromptHarness({ sampleSize: 100 });

            for (let i = 0; i < 100; i = i + 1) {
                getRandomIntStub.returns(i);
                expect(prompt.shouldShowBanner()).to.equal(true, 'Banner should be shown');
            }
        });

        test('Always returns false if sample size is 0', () => {
            const { prompt, getRandomIntStub } = createSurveyPromptHarness({ sampleSize: 0 });

            for (let i = 0; i < 100; i = i + 1) {
                getRandomIntStub.returns(i);
                expect(prompt.shouldShowBanner()).to.equal(false, 'Banner should not be shown');
            }
            sinon.assert.callCount(getRandomIntStub, 100);
        });
    });

    suite('showSurvey()', () => {
        const expectedPrompts = [
            ExtensionSurveyBanner.bannerLabelYes,
            ExtensionSurveyBanner.maybeLater,
            Common.doNotShowAgain,
        ];

        function expectSurveyState(
            persistentStateFactory: PersistentStateFactory,
            expected: { disableForTime: boolean; doNotShowAgain: boolean },
        ) {
            expect(
                persistentStateFactory.createGlobalPersistentState(
                    extensionSurveyStateKeys.disableSurveyForTime,
                    false,
                    TWELVE_WEEKS_MS,
                ).value,
            ).to.equal(expected.disableForTime);
            expect(
                persistentStateFactory.createGlobalPersistentState(extensionSurveyStateKeys.doNotShowAgain, false)
                    .value,
            ).to.equal(expected.doNotShowAgain);
        }

        test("Launches survey and temporarily disables prompt if 'Yes' option is clicked", async () => {
            const {
                prompt,
                persistentStateFactory,
                showInformationMessageStub,
                browserLaunchStub,
            } = createSurveyPromptHarness({
                showInformationMessageResult: ExtensionSurveyBanner.bannerLabelYes,
            });
            const expectedUrl = 'https://aka.ms/AA5rjx5?o=Windows&v=vscodeVersion&e=extensionVersion&m=sessionId';

            await prompt.showSurvey();

            sinon.assert.calledOnceWithExactly(
                showInformationMessageStub,
                ExtensionSurveyBanner.bannerMessage,
                ...expectedPrompts,
            );
            sinon.assert.calledOnceWithExactly(browserLaunchStub, expectedUrl);
            expectSurveyState(persistentStateFactory, { disableForTime: true, doNotShowAgain: false });
            expect(prompt.shouldShowBanner()).to.equal(false);
        });

        test("Does nothing if 'Maybe later' option is clicked", async () => {
            const {
                prompt,
                persistentStateFactory,
                showInformationMessageStub,
                browserLaunchStub,
            } = createSurveyPromptHarness({
                showInformationMessageResult: ExtensionSurveyBanner.maybeLater,
            });

            await prompt.showSurvey();

            sinon.assert.calledOnceWithExactly(
                showInformationMessageStub,
                ExtensionSurveyBanner.bannerMessage,
                ...expectedPrompts,
            );
            sinon.assert.notCalled(browserLaunchStub);
            expectSurveyState(persistentStateFactory, { disableForTime: false, doNotShowAgain: false });
            expect(prompt.shouldShowBanner()).to.equal(true);
        });

        test('Does nothing if no option is clicked', async () => {
            const {
                prompt,
                persistentStateFactory,
                showInformationMessageStub,
                browserLaunchStub,
            } = createSurveyPromptHarness({
                showInformationMessageResult: undefined,
            });

            await prompt.showSurvey();

            sinon.assert.calledOnceWithExactly(
                showInformationMessageStub,
                ExtensionSurveyBanner.bannerMessage,
                ...expectedPrompts,
            );
            sinon.assert.notCalled(browserLaunchStub);
            expectSurveyState(persistentStateFactory, { disableForTime: false, doNotShowAgain: false });
        });

        test('Disables prompt permanently if "Don\'t show again" option is clicked', async () => {
            const {
                prompt,
                persistentStateFactory,
                showInformationMessageStub,
                browserLaunchStub,
            } = createSurveyPromptHarness({
                showInformationMessageResult: Common.doNotShowAgain,
            });

            await prompt.showSurvey();

            sinon.assert.calledOnceWithExactly(
                showInformationMessageStub,
                ExtensionSurveyBanner.bannerMessage,
                ...expectedPrompts,
            );
            sinon.assert.notCalled(browserLaunchStub);
            expectSurveyState(persistentStateFactory, { disableForTime: false, doNotShowAgain: true });
            expect(prompt.shouldShowBanner()).to.equal(false);
        });
    });

    suite('activate()', () => {
        test("If user is not in 'ShowExtensionSurveyPrompt' experiment, returns immediately", async () => {
            const clock = sinon.useFakeTimers({ now: 1_000_000 });
            const {
                prompt,
                inExperimentStub,
                getRandomIntStub,
                showInformationMessageStub,
            } = createSurveyPromptHarness({
                inExperiment: false,
                waitTimeToShowSurvey: 50,
            });

            await prompt.activate();
            await clock.tickAsync(100);

            sinon.assert.calledOnceWithExactly(inExperimentStub, ShowExtensionSurveyPrompt.experiment);
            sinon.assert.notCalled(getRandomIntStub);
            sinon.assert.notCalled(showInformationMessageStub);
        });

        test("No survey is shown if shouldShowBanner() returns false and user is in 'ShowExtensionSurveyPrompt' experiment", async () => {
            const clock = sinon.useFakeTimers({ now: 1_000_000 });
            const {
                prompt,
                inExperimentStub,
                getRandomIntStub,
                showInformationMessageStub,
            } = createSurveyPromptHarness({
                inExperiment: true,
                randomInt: 50,
                waitTimeToShowSurvey: 50,
            });

            await prompt.activate();
            await clock.tickAsync(100);

            sinon.assert.calledOnceWithExactly(inExperimentStub, ShowExtensionSurveyPrompt.experiment);
            sinon.assert.calledOnce(getRandomIntStub);
            sinon.assert.notCalled(showInformationMessageStub);
        });

        test("Survey is shown after waitTimeToShowSurvey if shouldShowBanner() returns true and user is in 'ShowExtensionSurveyPrompt' experiment", async () => {
            const clock = sinon.useFakeTimers({ now: 1_000_000 });
            const {
                prompt,
                inExperimentStub,
                showInformationMessageStub,
                browserLaunchStub,
            } = createSurveyPromptHarness({
                inExperiment: true,
                randomInt: 0,
                waitTimeToShowSurvey: 50,
                showInformationMessageResult: ExtensionSurveyBanner.bannerLabelYes,
            });

            await prompt.activate();
            sinon.assert.calledOnceWithExactly(inExperimentStub, ShowExtensionSurveyPrompt.experiment);

            await clock.tickAsync(49);
            sinon.assert.notCalled(showInformationMessageStub);

            await clock.tickAsync(1);
            sinon.assert.calledOnce(showInformationMessageStub);
            sinon.assert.calledOnce(browserLaunchStub);
        });
    });
});

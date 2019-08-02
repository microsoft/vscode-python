// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { anything, instance, mock, verify, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { ExtensionSurveyPrompt, extensionSurveyStateKeys } from '../../client/activation/extensionSurvey';
import { IApplicationShell } from '../../client/common/application/types';
import { PersistentStateFactory } from '../../client/common/persistentState';
import { IBrowserService, IPersistentState, IPersistentStateFactory, IRandom } from '../../client/common/types';

// tslint:disable:no-any

// tslint:disable-next-line:max-func-body-length
suite('xExtension survey prompt - shouldShowBanner()', () => {
    let appShell: TypeMoq.IMock<IApplicationShell>;
    let browserService: TypeMoq.IMock<IBrowserService>;
    let random: TypeMoq.IMock<IRandom>;
    let persistentStateFactory: IPersistentStateFactory;
    let disableSurveyForTime: TypeMoq.IMock<IPersistentState<any>>;
    let doNotShowAgain: TypeMoq.IMock<IPersistentState<any>>;
    let extensionSurveyPrompt: ExtensionSurveyPrompt;
    setup(() => {
        appShell = TypeMoq.Mock.ofType<IApplicationShell>();
        browserService = TypeMoq.Mock.ofType<IBrowserService>();
        random = TypeMoq.Mock.ofType<IRandom>();
        persistentStateFactory = mock(PersistentStateFactory);
        disableSurveyForTime = TypeMoq.Mock.ofType<IPersistentState<any>>();
        doNotShowAgain = TypeMoq.Mock.ofType<IPersistentState<any>>();
        when(persistentStateFactory.createGlobalPersistentState(extensionSurveyStateKeys.disableSurveyForTime, false, anything())).thenReturn(disableSurveyForTime.object);
        when(persistentStateFactory.createGlobalPersistentState(extensionSurveyStateKeys.doNotShowAgain, false)).thenReturn(doNotShowAgain.object);
        extensionSurveyPrompt = new ExtensionSurveyPrompt(appShell.object, browserService.object, instance(persistentStateFactory), random.object, 10);
    });
    test('Returns false if do not show again is clicked', async () => {
        random
            .setup(r => r.getRandomInt(0, 100))
            .returns(() => 10)
            .verifiable(TypeMoq.Times.never());
        doNotShowAgain
            .setup(d => d.value)
            .returns(() => true);

        const result = extensionSurveyPrompt.shouldShowBanner();

        expect(result).to.equal(false, 'Banner should not be shown');
        verify(persistentStateFactory.createGlobalPersistentState(extensionSurveyStateKeys.disableSurveyForTime, false, anything())).never();
        verify(persistentStateFactory.createGlobalPersistentState(extensionSurveyStateKeys.doNotShowAgain, false)).once();
        random.verifyAll();
    });
    test('Returns false if prompt is disabled for a while', async () => {
        random
            .setup(r => r.getRandomInt(0, 100))
            .returns(() => 10)
            .verifiable(TypeMoq.Times.never());
        disableSurveyForTime
            .setup(d => d.value)
            .returns(() => true);
        doNotShowAgain
            .setup(d => d.value)
            .returns(() => false);

        const result = extensionSurveyPrompt.shouldShowBanner();

        expect(result).to.equal(false, 'Banner should not be shown');
        verify(persistentStateFactory.createGlobalPersistentState(extensionSurveyStateKeys.disableSurveyForTime, false, anything())).once();
        verify(persistentStateFactory.createGlobalPersistentState(extensionSurveyStateKeys.doNotShowAgain, false)).once();
        random.verifyAll();
    });
    test('Returns false if user is not in the random sampling', async () => {
        disableSurveyForTime
            .setup(d => d.value)
            .returns(() => false);
        doNotShowAgain
            .setup(d => d.value)
            .returns(() => false);
        for (let i = 11; i < 100; i = i + 1) {
            random
                .setup(r => r.getRandomInt(0, 100))
                .returns(() => i);
            const result = extensionSurveyPrompt.shouldShowBanner();
            expect(result).to.equal(false, 'Banner should not be shown');
        }
        random.verifyAll();
    });
    test('Returns true if user is in the random sampling', async () => {
        disableSurveyForTime
            .setup(d => d.value)
            .returns(() => false);
        doNotShowAgain
            .setup(d => d.value)
            .returns(() => false);
        for (let i = 0; i < 10; i = i + 1) {
            random
                .setup(r => r.getRandomInt(0, 100))
                .returns(() => i);
            const result = extensionSurveyPrompt.shouldShowBanner();
            expect(result).to.equal(true, 'Banner should be shown');
        }
    });

    test('Always return true if sample size is 100', async () => {
        extensionSurveyPrompt = new ExtensionSurveyPrompt(appShell.object, browserService.object, instance(persistentStateFactory), random.object, 100);
        disableSurveyForTime
            .setup(d => d.value)
            .returns(() => false);
        doNotShowAgain
            .setup(d => d.value)
            .returns(() => false);
        for (let i = 0; i < 100; i = i + 1) {
            random
                .setup(r => r.getRandomInt(0, 100))
                .returns(() => i);
            const result = extensionSurveyPrompt.shouldShowBanner();
            expect(result).to.equal(true, 'Banner should be shown');
        }
    });

    test('Always return false if sample size is 0', async () => {
        extensionSurveyPrompt = new ExtensionSurveyPrompt(appShell.object, browserService.object, instance(persistentStateFactory), random.object, 0);
        disableSurveyForTime
            .setup(d => d.value)
            .returns(() => false);
        doNotShowAgain
            .setup(d => d.value)
            .returns(() => false);
        for (let i = 0; i < 100; i = i + 1) {
            random
                .setup(r => r.getRandomInt(0, 100))
                .returns(() => i);
            const result = extensionSurveyPrompt.shouldShowBanner();
            expect(result).to.equal(false, 'Banner should not be shown');
        }
        random.verifyAll();
    });
});

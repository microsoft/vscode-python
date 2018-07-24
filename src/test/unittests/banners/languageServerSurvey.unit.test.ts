// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length

import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { IApplicationShell } from '../../../client/common/application/types';
import { IBrowserService, IConfigurationService, IPersistentState, IPersistentStateFactory } from '../../../client/common/types';
import { LanguageServerSurveyBanner, LSSurveyStateKeys } from '../../../client/languageServices/languageServerSurveyBanner';

suite('Language Server Survey Banner', () => {
    let config: typemoq.IMock<IConfigurationService>;
    let appShell: typemoq.IMock<IApplicationShell>;
    let browser: typemoq.IMock<IBrowserService>;
    const message = 'Can you please take 2 minutes to tell us how the Experimental Debugger is working for you?';
    const yes = 'Yes, take survey now';
    const no = 'No, thanks';

    setup(() => {
        config = typemoq.Mock.ofType<IConfigurationService>();
        appShell = typemoq.Mock.ofType<IApplicationShell>();
        browser = typemoq.Mock.ofType<IBrowserService>();
    });
    test('Is debugger enabled upon creation?', () => {
        const enabledValue: boolean = true;
        const attemptCounter: number = 0;
        const completionsCount: number = 0;
        const testBanner: LanguageServerSurveyBanner = preparePopup(attemptCounter, completionsCount, enabledValue, 0, 100, appShell.object, browser.object);
        expect(testBanner.enabled).to.be.equal(true, 'Sampling 100/100 should always enable the banner.');
    });
    test('Do not show banner when it is disabled', () => {
        appShell.setup(a => a.showInformationMessage(typemoq.It.isValue(message),
                                                    typemoq.It.isValue(yes),
                                                    typemoq.It.isValue(no)))
            .verifiable(typemoq.Times.never());
        const enabledValue: boolean = true;
        const attemptCounter: number = 0;
        const completionsCount: number = 0;
        const testBanner: LanguageServerSurveyBanner = preparePopup(attemptCounter, completionsCount, enabledValue, 0, 0, appShell.object, browser.object);
        testBanner.showBanner().ignoreErrors();
    });
    test('shouldShowBanner must return false when Banner is implicitly disabled by sampling', () => {
        const enabledValue: boolean = true;
        const attemptCounter: number = 0;
        const completionsCount: number = 0;
        const testBanner: LanguageServerSurveyBanner = preparePopup(attemptCounter, completionsCount, enabledValue, 0, 0, appShell.object, browser.object);
        expect(testBanner.enabled).to.be.equal(false, 'We implicitly disabled the banner, it should never show.');
    });
});

function preparePopup(attemptCounter: number, completionsCount: number, enabledValue: boolean, minCompletionCount: number, maxCompletionCount: number, appShell: IApplicationShell, browser: IBrowserService): LanguageServerSurveyBanner {
    const myfactory: typemoq.IMock<IPersistentStateFactory> = typemoq.Mock.ofType<IPersistentStateFactory>();
    const enabledValState: typemoq.IMock<IPersistentState<boolean>> = typemoq.Mock.ofType<IPersistentState<boolean>>();
    const attemptCountState: typemoq.IMock<IPersistentState<number>> = typemoq.Mock.ofType<IPersistentState<number>>();
    const completionCountState: typemoq.IMock<IPersistentState<number>> = typemoq.Mock.ofType<IPersistentState<number>>();

    enabledValState.setup(a => a.updateValue(typemoq.It.isValue(true))).returns(() => {
        enabledValue = true;
        return Promise.resolve();
    });
    enabledValState.setup(a => a.updateValue(typemoq.It.isValue(false))).returns(() => {
        enabledValue = false;
        return Promise.resolve();
    });

    attemptCountState.setup(a => a.updateValue(typemoq.It.isAnyNumber())).returns(() => {
        attemptCounter += 1;
        return Promise.resolve();
    });

    completionCountState.setup(a => a.updateValue(typemoq.It.isAnyNumber())).returns(() => {
        completionsCount += 1;
        return Promise.resolve();
    });

    enabledValState.setup(a => a.value).returns(() => enabledValue);
    attemptCountState.setup(a => a.value).returns(() => attemptCounter);
    completionCountState.setup(a => a.value).returns(() => completionsCount);

    myfactory.setup(a => a.createGlobalPersistentState(typemoq.It.isValue(LSSurveyStateKeys.ShowBanner),
        typemoq.It.isValue(true))).returns(() => {
            return enabledValState.object;
        });
    myfactory.setup(a => a.createGlobalPersistentState(typemoq.It.isValue(LSSurveyStateKeys.ShowBanner),
        typemoq.It.isValue(false))).returns(() => {
            return enabledValState.object;
        });
    myfactory.setup(a => a.createGlobalPersistentState(typemoq.It.isValue(LSSurveyStateKeys.ShowAttemptCounter),
        typemoq.It.isAnyNumber())).returns(() => {
            return attemptCountState.object;
        });
    myfactory.setup(a => a.createGlobalPersistentState(typemoq.It.isValue(LSSurveyStateKeys.ShowAfterCompletionCount),
        typemoq.It.isAnyNumber())).returns(() => {
            return completionCountState.object;
        });
    return new LanguageServerSurveyBanner(
        appShell,
        myfactory.object,
        browser,
        minCompletionCount,
        maxCompletionCount);
}

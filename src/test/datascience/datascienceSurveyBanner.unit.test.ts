// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length

import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { IApplicationShell } from '../../client/common/application/types';
import { IBrowserService, IPersistentState, IPersistentStateFactory } from '../../client/common/types';
import { DataScienceSurveyBanner, DSSurveyStateKeys } from '../../client/datascience/dataScienceSurveyBanner';

suite('Data Science Survey Banner', () => {
    let appShell: typemoq.IMock<IApplicationShell>;
    let browser: typemoq.IMock<IBrowserService>;
    const targetUri: string = 'https://microsoft.com';

    const message =
        'Can you please take 2 minutes to tell us how the Python Data Science features are working for you?';
    const yes = 'Yes, take survey now';
    const no = 'No, thanks';

    setup(() => {
        appShell = typemoq.Mock.ofType<IApplicationShell>();
        browser = typemoq.Mock.ofType<IBrowserService>();
    });
    test('Data science banner should be enabled after we hit our command execution count', async () => {
        const enabledValue: boolean = true;
        const attemptCounter: number = 1000;
        const testBanner: DataScienceSurveyBanner = preparePopup(
            attemptCounter,
            enabledValue,
            0,
            appShell.object,
            browser.object,
            targetUri
        );
        const expectedUri: string = targetUri;
        let receivedUri: string = '';
        browser
            .setup(b =>
                b.launch(
                    typemoq.It.is((a: string) => {
                        receivedUri = a;
                        return a === expectedUri;
                    })
                )
            )
            .verifiable(typemoq.Times.once());
        await testBanner.launchSurvey();
        // This is technically not necessary, but it gives
        // better output than the .verifyAll messages do.
        expect(receivedUri).is.equal(expectedUri, 'Uri given to launch mock is incorrect.');

        // verify that the calls expected were indeed made.
        browser.verifyAll();
        browser.reset();
    });
    test('Do not show data science banner when it is disabled', () => {
        appShell
            .setup(a =>
                a.showInformationMessage(typemoq.It.isValue(message), typemoq.It.isValue(yes), typemoq.It.isValue(no))
            )
            .verifiable(typemoq.Times.never());
        const enabledValue: boolean = false;
        const attemptCounter: number = 0;
        const testBanner: DataScienceSurveyBanner = preparePopup(
            attemptCounter,
            enabledValue,
            0,
            appShell.object,
            browser.object,
            targetUri
        );
        testBanner.showBanner().ignoreErrors();
    });
    test('Do not show data science banner if we have not hit our command count', () => {
        appShell
            .setup(a =>
                a.showInformationMessage(typemoq.It.isValue(message), typemoq.It.isValue(yes), typemoq.It.isValue(no))
            )
            .verifiable(typemoq.Times.never());
        const enabledValue: boolean = true;
        const attemptCounter: number = 100;
        const testBanner: DataScienceSurveyBanner = preparePopup(
            attemptCounter,
            enabledValue,
            1000,
            appShell.object,
            browser.object,
            targetUri
        );
        testBanner.showBanner().ignoreErrors();
    });
});

function preparePopup(
    commandCounter: number,
    enabledValue: boolean,
    commandThreshold: number,
    appShell: IApplicationShell,
    browser: IBrowserService,
    targetUri: string
): DataScienceSurveyBanner {
    const myfactory: typemoq.IMock<IPersistentStateFactory> = typemoq.Mock.ofType<IPersistentStateFactory>();
    const enabledValState: typemoq.IMock<IPersistentState<boolean>> = typemoq.Mock.ofType<IPersistentState<boolean>>();
    const attemptCountState: typemoq.IMock<IPersistentState<number>> = typemoq.Mock.ofType<IPersistentState<number>>();
    enabledValState
        .setup(a => a.updateValue(typemoq.It.isValue(true)))
        .returns(() => {
            enabledValue = true;
            return Promise.resolve();
        });
    enabledValState
        .setup(a => a.updateValue(typemoq.It.isValue(false)))
        .returns(() => {
            enabledValue = false;
            return Promise.resolve();
        });

    attemptCountState
        .setup(a => a.updateValue(typemoq.It.isAnyNumber()))
        .returns(() => {
            commandCounter += 1;
            return Promise.resolve();
        });

    enabledValState.setup(a => a.value).returns(() => enabledValue);
    attemptCountState.setup(a => a.value).returns(() => commandCounter);

    myfactory
        .setup(a =>
            a.createGlobalPersistentState(typemoq.It.isValue(DSSurveyStateKeys.ShowBanner), typemoq.It.isValue(true))
        )
        .returns(() => {
            return enabledValState.object;
        });
    myfactory
        .setup(a =>
            a.createGlobalPersistentState(typemoq.It.isValue(DSSurveyStateKeys.ShowBanner), typemoq.It.isValue(false))
        )
        .returns(() => {
            return enabledValState.object;
        });
    myfactory
        .setup(a =>
            a.createGlobalPersistentState(
                typemoq.It.isValue(DSSurveyStateKeys.ShowAttemptCounter),
                typemoq.It.isAnyNumber()
            )
        )
        .returns(() => {
            return attemptCountState.object;
        });
    return new DataScienceSurveyBanner(appShell, myfactory.object, browser, commandThreshold, targetUri);
}

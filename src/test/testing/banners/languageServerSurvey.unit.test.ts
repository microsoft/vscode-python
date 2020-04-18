// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as typemoq from 'typemoq';
import { FolderVersionPair, ILanguageServerFolderService } from '../../../client/activation/types';
import { IApplicationShell } from '../../../client/common/application/types';
import { IBrowserService, IPersistentState, IPersistentStateFactory } from '../../../client/common/types';
import {
    LanguageServerSurveyBanner,
    LSSurveyStateKeys
} from '../../../client/languageServices/languageServerSurveyBanner';

suite('Language Server Survey Banner', () => {
    let appShell: typemoq.IMock<IApplicationShell>;
    let browser: typemoq.IMock<IBrowserService>;
    let lsService: typemoq.IMock<ILanguageServerFolderService>;

    const message = 'Can you please take 2 minutes to tell us how the Experimental Debugger is working for you?';
    const yes = 'Yes, take survey now';
    const no = 'No, thanks';

    setup(() => {
        appShell = typemoq.Mock.ofType<IApplicationShell>();
        browser = typemoq.Mock.ofType<IBrowserService>();
        lsService = typemoq.Mock.ofType<ILanguageServerFolderService>();
    });
    test('Is debugger enabled upon creation?', () => {
        const enabledValue: boolean = true;
        const attemptCounter: number = 0;
        const completionsCount: number = 0;
        const testBanner: LanguageServerSurveyBanner = preparePopup(
            attemptCounter,
            completionsCount,
            enabledValue,
            0,
            100,
            appShell.object,
            browser.object,
            lsService.object
        );
        expect(testBanner.enabled).to.be.equal(true, 'Sampling 100/100 should always enable the banner.');
    });
    test('Do not show banner when it is disabled', () => {
        appShell
            .setup((a) =>
                a.showInformationMessage(typemoq.It.isValue(message), typemoq.It.isValue(yes), typemoq.It.isValue(no))
            )
            .verifiable(typemoq.Times.never());
        const enabledValue: boolean = true;
        const attemptCounter: number = 0;
        const completionsCount: number = 0;
        const testBanner: LanguageServerSurveyBanner = preparePopup(
            attemptCounter,
            completionsCount,
            enabledValue,
            0,
            0,
            appShell.object,
            browser.object,
            lsService.object
        );
        testBanner.showBanner().ignoreErrors();
    });
    test('shouldShowBanner must return false when Banner is implicitly disabled by sampling', () => {
        const enabledValue: boolean = true;
        const attemptCounter: number = 0;
        const completionsCount: number = 0;
        const testBanner: LanguageServerSurveyBanner = preparePopup(
            attemptCounter,
            completionsCount,
            enabledValue,
            0,
            0,
            appShell.object,
            browser.object,
            lsService.object
        );
        expect(testBanner.enabled).to.be.equal(false, 'We implicitly disabled the banner, it should never show.');
    });

    const languageServerVersions: string[] = [
        '1.2.3',
        '1.2.3-alpha',
        '0.0.1234567890',
        '1234567890.0.1',
        '1.0.1-alpha+2',
        '22.4.999-rc.6'
    ];
    languageServerVersions.forEach(async (languageServerVersion: string) => {
        test(`Survey URL is as expected for Language Server version '${languageServerVersion}'.`, async () => {
            const enabledValue: boolean = true;
            const attemptCounter: number = 42;
            const completionsCount: number = 0;

            // the expected URI as provided in issue #2630
            // with mocked-up test replacement values

            const expectedUri: string = `https://www.research.net/r/LJZV9BZ?n=${attemptCounter}&v=${encodeURIComponent(
                languageServerVersion
            )}`;

            const lsFolder: FolderVersionPair = {
                path: '/some/path',
                version: new SemVer(languageServerVersion, true)
            };
            // language service will get asked for the current Language
            // Server directory installed. This in turn will give the tested
            // code the version via the .version member of lsFolder.
            lsService
                .setup((f) => f.getCurrentLanguageServerDirectory())
                .returns(() => {
                    return Promise.resolve(lsFolder);
                })
                .verifiable(typemoq.Times.once());

            // The browser service will be asked to launch a URI that is
            // built using similar constants to those found in this test
            // suite. The exact built URI should be received in a single call
            // to launch.
            let receivedUri: string = '';
            browser
                .setup((b) =>
                    b.launch(
                        typemoq.It.is((a: string) => {
                            receivedUri = a;
                            return a === expectedUri;
                        })
                    )
                )
                .verifiable(typemoq.Times.once());

            const testBanner: LanguageServerSurveyBanner = preparePopup(
                attemptCounter,
                completionsCount,
                enabledValue,
                0,
                0,
                appShell.object,
                browser.object,
                lsService.object
            );
            await testBanner.launchSurvey();

            // This is technically not necessary, but it gives
            // better output than the .verifyAll messages do.
            expect(receivedUri).is.equal(expectedUri, 'Uri given to launch mock is incorrect.');

            // verify that the calls expected were indeed made.
            lsService.verifyAll();
            browser.verifyAll();

            lsService.reset();
            browser.reset();
        });
    });
});

function preparePopup(
    attemptCounter: number,
    completionsCount: number,
    enabledValue: boolean,
    minCompletionCount: number,
    maxCompletionCount: number,
    appShell: IApplicationShell,
    browser: IBrowserService,
    lsService: ILanguageServerFolderService
): LanguageServerSurveyBanner {
    const myfactory: typemoq.IMock<IPersistentStateFactory> = typemoq.Mock.ofType<IPersistentStateFactory>();
    const enabledValState: typemoq.IMock<IPersistentState<boolean>> = typemoq.Mock.ofType<IPersistentState<boolean>>();
    const attemptCountState: typemoq.IMock<IPersistentState<number>> = typemoq.Mock.ofType<IPersistentState<number>>();
    const completionCountState: typemoq.IMock<IPersistentState<number>> = typemoq.Mock.ofType<
        IPersistentState<number>
    >();
    enabledValState
        .setup((a) => a.updateValue(typemoq.It.isValue(true)))
        .returns(() => {
            enabledValue = true;
            return Promise.resolve();
        });
    enabledValState
        .setup((a) => a.updateValue(typemoq.It.isValue(false)))
        .returns(() => {
            enabledValue = false;
            return Promise.resolve();
        });

    attemptCountState
        .setup((a) => a.updateValue(typemoq.It.isAnyNumber()))
        .returns(() => {
            attemptCounter += 1;
            return Promise.resolve();
        });

    completionCountState
        .setup((a) => a.updateValue(typemoq.It.isAnyNumber()))
        .returns(() => {
            completionsCount += 1;
            return Promise.resolve();
        });

    enabledValState.setup((a) => a.value).returns(() => enabledValue);
    attemptCountState.setup((a) => a.value).returns(() => attemptCounter);
    completionCountState.setup((a) => a.value).returns(() => completionsCount);

    myfactory
        .setup((a) =>
            a.createGlobalPersistentState(typemoq.It.isValue(LSSurveyStateKeys.ShowBanner), typemoq.It.isValue(true))
        )
        .returns(() => {
            return enabledValState.object;
        });
    myfactory
        .setup((a) =>
            a.createGlobalPersistentState(typemoq.It.isValue(LSSurveyStateKeys.ShowBanner), typemoq.It.isValue(false))
        )
        .returns(() => {
            return enabledValState.object;
        });
    myfactory
        .setup((a) =>
            a.createGlobalPersistentState(
                typemoq.It.isValue(LSSurveyStateKeys.ShowAttemptCounter),
                typemoq.It.isAnyNumber()
            )
        )
        .returns(() => {
            return attemptCountState.object;
        });
    myfactory
        .setup((a) =>
            a.createGlobalPersistentState(
                typemoq.It.isValue(LSSurveyStateKeys.ShowAfterCompletionCount),
                typemoq.It.isAnyNumber()
            )
        )
        .returns(() => {
            return completionCountState.object;
        });
    return new LanguageServerSurveyBanner(
        appShell,
        myfactory.object,
        browser,
        lsService,
        minCompletionCount,
        maxCompletionCount
    );
}

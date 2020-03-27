// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length

import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { IApplicationShell } from '../../../client/common/application/types';
import { IConfigurationService, IPersistentState, IPersistentStateFactory } from '../../../client/common/types';
import {
    ProposeLanguageServerBanner,
    ProposeLSStateKeys,
} from '../../../client/languageServices/proposeLanguageServerBanner';

suite('Propose New Language Server Banner', () => {
    let config: typemoq.IMock<IConfigurationService>;
    let appShell: typemoq.IMock<IApplicationShell>;
    const message =
        'Try out Preview of our new Python Language Server to get richer and faster IntelliSense completions, and syntax errors as you type.';
    const yes = 'Try it now';
    const no = 'No thanks';
    const later = 'Remind me Later';

    setup(() => {
        config = typemoq.Mock.ofType<IConfigurationService>();
        appShell = typemoq.Mock.ofType<IApplicationShell>();
    });
    test('Is debugger enabled upon creation?', () => {
        const enabledValue: boolean = true;
        const testBanner: ProposeLanguageServerBanner = preparePopup(enabledValue, 100, appShell.object, config.object);
        expect(testBanner.enabled).to.be.equal(true, 'Sampling 100/100 should always enable the banner.');
    });
    test('Do not show banner when it is disabled', () => {
        appShell
            .setup((a) =>
                a.showInformationMessage(
                    typemoq.It.isValue(message),
                    typemoq.It.isValue(yes),
                    typemoq.It.isValue(no),
                    typemoq.It.isValue(later)
                )
            )
            .verifiable(typemoq.Times.never());
        const enabled: boolean = true;
        const testBanner: ProposeLanguageServerBanner = preparePopup(enabled, 0, appShell.object, config.object);
        testBanner.showBanner().ignoreErrors();
    });
    test('shouldShowBanner must return false when Banner is implicitly disabled by sampling', () => {
        const enabled: boolean = true;
        const testBanner: ProposeLanguageServerBanner = preparePopup(enabled, 0, appShell.object, config.object);
        expect(testBanner.enabled).to.be.equal(false, 'We implicitly disabled the banner, it should never show.');
    });
    test('shouldShowBanner must return false when Banner is explicitly disabled', async () => {
        const enabled: boolean = true;
        const testBanner: ProposeLanguageServerBanner = preparePopup(enabled, 100, appShell.object, config.object);

        expect(await testBanner.shouldShowBanner()).to.be.equal(
            true,
            '100% sample size should always make the banner enabled.'
        );
        await testBanner.disable();
        expect(await testBanner.shouldShowBanner()).to.be.equal(
            false,
            'Explicitly disabled banner shouldShowBanner != false.'
        );
    });
});

function preparePopup(
    enabledValue: boolean,
    sampleValue: number,
    appShell: IApplicationShell,
    config: IConfigurationService
): ProposeLanguageServerBanner {
    const myfactory: typemoq.IMock<IPersistentStateFactory> = typemoq.Mock.ofType<IPersistentStateFactory>();
    const val: typemoq.IMock<IPersistentState<boolean>> = typemoq.Mock.ofType<IPersistentState<boolean>>();
    val.setup((a) => a.updateValue(typemoq.It.isValue(true))).returns(() => {
        enabledValue = true;
        return Promise.resolve();
    });
    val.setup((a) => a.updateValue(typemoq.It.isValue(false))).returns(() => {
        enabledValue = false;
        return Promise.resolve();
    });
    val.setup((a) => a.value).returns(() => {
        return enabledValue;
    });
    myfactory
        .setup((a) =>
            a.createGlobalPersistentState(typemoq.It.isValue(ProposeLSStateKeys.ShowBanner), typemoq.It.isValue(true))
        )
        .returns(() => {
            return val.object;
        });
    myfactory
        .setup((a) =>
            a.createGlobalPersistentState(typemoq.It.isValue(ProposeLSStateKeys.ShowBanner), typemoq.It.isValue(false))
        )
        .returns(() => {
            return val.object;
        });
    return new ProposeLanguageServerBanner(appShell, myfactory.object, config, sampleValue);
}

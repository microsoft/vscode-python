// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { IApplicationEnvironment, IApplicationShell } from '../../../client/common/application/types';
import { IConfigurationService, IPersistentState, IPersistentStateFactory } from '../../../client/common/types';
import { LanguageService } from '../../../client/common/utils/localize';
import { ProposeLSStateKeys, ProposePylanceBanner } from '../../../client/languageServices/proposeLanguageServerBanner';

suite('Propose Pylance Banner', () => {
    let config: typemoq.IMock<IConfigurationService>;
    let appShell: typemoq.IMock<IApplicationShell>;
    let appEnv: typemoq.IMock<IApplicationEnvironment>;

    const message = LanguageService.proposePylanceMessage();
    const yes = LanguageService.tryItNow();
    const no = LanguageService.bannerLabelNo();
    const later = LanguageService.remindMeLater();

    setup(() => {
        config = typemoq.Mock.ofType<IConfigurationService>();
        appShell = typemoq.Mock.ofType<IApplicationShell>();
        appEnv = typemoq.Mock.ofType<IApplicationEnvironment>();
    });
    test('Sampling 100/100 enables the banner', () => {
        const enabledValue = true;
        const testBanner = preparePopup(enabledValue, appShell.object, config.object, appEnv.object, 100);
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
        const testBanner = preparePopup(enabled, appShell.object, config.object, appEnv.object, 0);
        testBanner.showBanner().ignoreErrors();
    });
    test('shouldShowBanner must return false when Banner is implicitly disabled by sampling', () => {
        const enabled = true;
        const testBanner = preparePopup(enabled, appShell.object, config.object, appEnv.object, 0);
        expect(testBanner.enabled).to.be.equal(false, 'We implicitly disabled the banner, it should never show.');
    });
    test('shouldShowBanner must return false when Banner is explicitly disabled', async () => {
        const enabled = true;
        const testBanner = preparePopup(enabled, appShell.object, config.object, appEnv.object, 100);

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
    appShell: IApplicationShell,
    config: IConfigurationService,
    appEnv: IApplicationEnvironment,
    sampleSizePerHundred: number
): ProposePylanceBanner {
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
    return new ProposePylanceBanner(appShell, myfactory.object, config, appEnv, sampleSizePerHundred);
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length

import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { LanguageServerType } from '../../../client/activation/types';
import { IApplicationEnvironment, IApplicationShell } from '../../../client/common/application/types';
import {
    IConfigurationService,
    IPersistentState,
    IPersistentStateFactory,
    IPythonSettings
} from '../../../client/common/types';
import * as localize from '../../../client/common/utils/localize';
import {
    ProposeLanguageServerBanner,
    ProposeLSStateKeys
} from '../../../client/languageServices/proposeLanguageServerBanner';

suite('Propose New Language Server Banner', () => {
    let config: typemoq.IMock<IConfigurationService>;
    let appEnvironment: typemoq.IMock<IApplicationEnvironment>;
    let appShell: typemoq.IMock<IApplicationShell>;
    let persistentStateFactory: typemoq.IMock<IPersistentStateFactory>;
    let persistentState: typemoq.IMock<IPersistentState<boolean>>;
    const message = localize.LanguageService.proposeLanguageServerMessage();

    const yes = localize.LanguageService.tryItNow();
    const no = localize.LanguageService.noThanks();
    const later = localize.LanguageService.remindMeLater();
    const bannerEnabledDate = new Date('June 1, 2020 0:0:1'); // Enabled by default here

    setup(() => {
        config = typemoq.Mock.ofType<IConfigurationService>();
        appEnvironment = typemoq.Mock.ofType<IApplicationEnvironment>();
        appShell = typemoq.Mock.ofType<IApplicationShell>();
        persistentStateFactory = typemoq.Mock.ofType<IPersistentStateFactory>();
        persistentState = typemoq.Mock.ofType<IPersistentState<boolean>>();
    });
    test('100 sampling must enable the banner', async () => {
        const testBanner = preparePopup(100);
        const enabled = await testBanner.isEnabled();
        expect(enabled).to.be.equal(true, 'Sampling 100/100 should always enable the banner.');
    });
    test('Banner should not use Microsoft LS key', async () => {
        expect(ProposeLSStateKeys.ProposeLSBanner).to.not.be.equal(
            'ProposeLSBanner',
            'Banner should not using Microsoft LS storage key.'
        );
    });
    test('Do not show banner when it is disabled', async () => {
        setupShowMessage('', typemoq.Times.never());
        const testBanner = preparePopup(0);
        await testBanner.showBanner();
    });
    test('Do not show banner before target date', async () => {
        setupShowMessage('', typemoq.Times.never());
        const testBanner = preparePopup(100, new Date('September 1, 2020 0:0:1'));
        await testBanner.showBanner();
    });
    test('isEnabled must return false when Banner is implicitly disabled by sampling', async () => {
        appEnvironment.setup((x) => x.channel).returns(() => 'stable');
        const testBanner = preparePopup(0);
        const enabled = await testBanner.isEnabled();
        expect(enabled).to.be.equal(false, 'We implicitly disabled the banner, it should never show.');
    });
    test('Banner must be enabled when channel is insiders', async () => {
        appEnvironment.setup((x) => x.channel).returns(() => 'insiders');
        const testBanner = preparePopup(0);
        const enabled = await testBanner.isEnabled();
        expect(enabled).to.be.equal(true, 'Banner in insiders channel did not show.');
    });
    test('Banner should be disabled if response was Yes', async () => {
        await testStateAfterResponse(yes, false);
    });
    test('Banner should be disabled if response was No', async () => {
        await testStateAfterResponse(no, false);
    });
    test('Banner should not be disabled in session if response was Later', async () => {
        await testStateAfterResponse(later, true);
    });
    test('Banner should save disabled state if response was Yes', async () => {
        await testSaveState(yes, true, false);
    });
    test('Banner should save disabled state if response was No', async () => {
        await testSaveState(no, true, false);
    });
    test('Banner should not save disabled state if response was Later', async () => {
        await testSaveState(later, false, false);
    });
    test('Banner should enable language server when answer is Yes', async () => {
        await testEnableLanguageServer(yes, true, LanguageServerType.Jedi, LanguageServerType.Node);
    });
    test('Banner should not change language server when answer is No', async () => {
        await testEnableLanguageServer(no, false, LanguageServerType.Jedi, LanguageServerType.Jedi);
    });
    test('Banner should not change language server when answer is Later', async () => {
        await testEnableLanguageServer(no, false, LanguageServerType.Microsoft, LanguageServerType.Microsoft);
    });
    test('shouldShowBanner must return false when Banner is explicitly disabled', async () => {
        appEnvironment.setup((x) => x.channel).returns(() => 'stable');
        const testBanner = preparePopup(100);

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

    async function testStateAfterResponse(response: string, state: boolean): Promise<void> {
        setupShowMessage(response, typemoq.Times.once());
        const testBanner = preparePopup(100);
        await testBanner.showBanner();

        const enabled = await testBanner.isEnabled();
        expect(enabled).to.be.equal(
            state,
            `Banner state is not ${state} in not disabled after user answered ${response}.`
        );
    }

    async function testSaveState(response: string, expectToSave: boolean, finalValue: boolean): Promise<void> {
        setupPersistentState(ProposeLSStateKeys.ProposeLSBanner, true);
        setupShowMessage(response, typemoq.Times.once());

        const testBanner = new ProposeLanguageServerBanner(
            appEnvironment.object,
            appShell.object,
            persistentStateFactory.object,
            config.object,
            100,
            bannerEnabledDate
        );
        await testBanner.showBanner();

        if (expectToSave) {
            persistentState.verify((x) => x.updateValue(typemoq.It.isAny()), typemoq.Times.once());
            expect(persistentState.object.value).to.be.equal(finalValue);
        } else {
            persistentState.verify((x) => x.updateValue(typemoq.It.isAny()), typemoq.Times.never());
        }

        const enabled = await testBanner.shouldShowBanner();
        expect(enabled).to.be.equal(finalValue, `shouldShowBanner expected to be ${finalValue}`);
    }

    async function testEnableLanguageServer(
        response: string,
        expectToSave: boolean,
        initialValue: LanguageServerType,
        finalValue: LanguageServerType
    ): Promise<void> {
        const settings = typemoq.Mock.ofType<IPythonSettings>();
        const lsKey = 'languageServer';

        let ls = initialValue;
        settings.setup((s) => s.languageServer).returns(() => ls);
        config.setup((c) => c.getSettings()).returns(() => settings.object);
        config
            .setup((c) => c.updateSetting(lsKey, finalValue, typemoq.It.isAny(), typemoq.It.isAny()))
            .returns((_n, v) => {
                ls = v;
                return Promise.resolve();
            })
            .verifiable(expectToSave ? typemoq.Times.once() : typemoq.Times.never());

        setupPersistentState(ProposeLSStateKeys.ProposeLSBanner, true);
        setupShowMessage(response, typemoq.Times.once());

        const testBanner = new ProposeLanguageServerBanner(
            appEnvironment.object,
            appShell.object,
            persistentStateFactory.object,
            config.object,
            100,
            bannerEnabledDate
        );
        await testBanner.showBanner();

        if (expectToSave) {
            expect(ls).to.be.equal(finalValue);
        }
    }

    function preparePopup(sampleValue: number, date?: Date): ProposeLanguageServerBanner {
        setupPersistentState(ProposeLSStateKeys.ProposeLSBanner, true);
        return new ProposeLanguageServerBanner(
            appEnvironment.object,
            appShell.object,
            persistentStateFactory.object,
            config.object,
            sampleValue,
            date ?? bannerEnabledDate
        );
    }

    function setupPersistentState(settingName: string, initialValue: boolean): void {
        let value = initialValue;
        persistentState
            .setup((a) => a.updateValue(typemoq.It.isValue(true)))
            .returns(() => {
                value = true;
                return Promise.resolve();
            });
        persistentState
            .setup((a) => a.updateValue(typemoq.It.isValue(false)))
            .returns(() => {
                value = false;
                return Promise.resolve();
            });
        persistentState
            .setup((a) => a.value)
            .returns(() => {
                return value;
            });
        persistentStateFactory
            .setup((a) => a.createGlobalPersistentState(settingName, typemoq.It.isAny()))
            .returns(() => {
                return persistentState.object;
            });
    }

    function setupShowMessage(response: string, times: typemoq.Times): void {
        appShell
            .setup((a) =>
                a.showInformationMessage(
                    typemoq.It.isValue(message),
                    typemoq.It.isValue(yes),
                    typemoq.It.isValue(no),
                    typemoq.It.isValue(later)
                )
            )
            .returns(() => Promise.resolve(response))
            .verifiable(times);
    }
});

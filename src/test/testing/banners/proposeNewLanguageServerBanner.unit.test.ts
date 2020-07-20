// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { LanguageServerType } from '../../../client/activation/types';
import { IApplicationShell } from '../../../client/common/application/types';
import { TryPylance } from '../../../client/common/experiments/groups';
import {
    IConfigurationService,
    IExperimentService,
    IPersistentState,
    IPersistentStateFactory,
    IPythonSettings
} from '../../../client/common/types';
import { LanguageService } from '../../../client/common/utils/localize';
import {
    ProposeLSStateKeys,
    ProposePylanceBanner,
    PylanceExtensionUri
} from '../../../client/languageServices/proposeLanguageServerBanner';

interface IExperimentLsCombination {
    inExperiment: boolean;
    lsType: LanguageServerType;
    shouldShowBanner: boolean;
}
const testData: IExperimentLsCombination[] = [
    { inExperiment: true, lsType: LanguageServerType.None, shouldShowBanner: true },
    { inExperiment: true, lsType: LanguageServerType.Microsoft, shouldShowBanner: true },
    { inExperiment: true, lsType: LanguageServerType.Node, shouldShowBanner: false },
    { inExperiment: true, lsType: LanguageServerType.Jedi, shouldShowBanner: false },
    { inExperiment: false, lsType: LanguageServerType.None, shouldShowBanner: false },
    { inExperiment: false, lsType: LanguageServerType.Microsoft, shouldShowBanner: false },
    { inExperiment: false, lsType: LanguageServerType.Node, shouldShowBanner: false },
    { inExperiment: false, lsType: LanguageServerType.Jedi, shouldShowBanner: false }
];

suite('Propose Pylance Banner', () => {
    let config: typemoq.IMock<IConfigurationService>;
    let appShell: typemoq.IMock<IApplicationShell>;
    let settings: typemoq.IMock<IPythonSettings>;

    const message = LanguageService.proposePylanceMessage();
    const yes = LanguageService.tryItNow();
    const no = LanguageService.bannerLabelNo();
    const later = LanguageService.remindMeLater();

    setup(() => {
        config = typemoq.Mock.ofType<IConfigurationService>();
        settings = typemoq.Mock.ofType<IPythonSettings>();
        config.setup((x) => x.getSettings(typemoq.It.isAny())).returns(() => settings.object);
        appShell = typemoq.Mock.ofType<IApplicationShell>();
    });
    testData.forEach((t) => {
        test(`${t.inExperiment ? 'In' : 'Not in'} experiment and "python.languageServer": "${t.lsType}" should ${
            t.shouldShowBanner ? 'show' : 'not show'
        } banner`, async () => {
            settings.setup((x) => x.languageServer).returns(() => t.lsType);
            const testBanner = preparePopup(true, appShell.object, config.object, t.inExperiment);
            const actual = await testBanner.shouldShowBanner();
            expect(actual).to.be.equal(t.shouldShowBanner, `shouldShowBanner() returned ${actual}`);
        });
    });
    test('Do not show banner when it is disabled', async () => {
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
        const testBanner = preparePopup(false, appShell.object, config.object, true);
        await testBanner.showBanner();
    });
    test('Clicking No should disable the banner', async () => {
        appShell
            .setup((a) =>
                a.showInformationMessage(
                    typemoq.It.isValue(message),
                    typemoq.It.isValue(yes),
                    typemoq.It.isValue(no),
                    typemoq.It.isValue(later)
                )
            )
            .returns(async () => no)
            .verifiable(typemoq.Times.once());
        appShell.setup((a) => a.openUrl(PylanceExtensionUri)).verifiable(typemoq.Times.never());

        const testBanner = preparePopup(true, appShell.object, config.object, true);
        await testBanner.showBanner();
        expect(testBanner.enabled).to.be.equal(false, 'Banner should be permanently disabled when user clicked No');
    });
    test('Clicking Later should disable banner in session', async () => {
        appShell
            .setup((a) =>
                a.showInformationMessage(
                    typemoq.It.isValue(message),
                    typemoq.It.isValue(yes),
                    typemoq.It.isValue(no),
                    typemoq.It.isValue(later)
                )
            )
            .returns(async () => later)
            .verifiable(typemoq.Times.once());
        appShell.setup((a) => a.openUrl(PylanceExtensionUri)).verifiable(typemoq.Times.never());

        const testBanner = preparePopup(true, appShell.object, config.object, true);
        await testBanner.showBanner();
        expect(testBanner.enabled).to.be.equal(
            true,
            'Banner should not be permanently disabled when user clicked Later'
        );
    });
    test('Clicking Yes opens the extension marketplace entry', async () => {
        appShell
            .setup((a) =>
                a.showInformationMessage(
                    typemoq.It.isValue(message),
                    typemoq.It.isValue(yes),
                    typemoq.It.isValue(no),
                    typemoq.It.isValue(later)
                )
            )
            .returns(async () => yes)
            .verifiable(typemoq.Times.once());
        appShell.setup((a) => a.openUrl(PylanceExtensionUri)).verifiable(typemoq.Times.once());

        const testBanner = preparePopup(true, appShell.object, config.object, true);
        await testBanner.showBanner();
        expect(testBanner.enabled).to.be.equal(false, 'Banner should be permanently disabled after opening store URL');
    });
});

function preparePopup(
    enabledValue: boolean,
    appShell: IApplicationShell,
    config: IConfigurationService,
    inExperiment: boolean
): ProposePylanceBanner {
    const myfactory = typemoq.Mock.ofType<IPersistentStateFactory>();
    const val = typemoq.Mock.ofType<IPersistentState<boolean>>();
    const experiments = typemoq.Mock.ofType<IExperimentService>();
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
    experiments.setup((x) => x.inExperiment(TryPylance.experiment)).returns(() => Promise.resolve(inExperiment));
    return new ProposePylanceBanner(appShell, myfactory.object, config, experiments.object);
}

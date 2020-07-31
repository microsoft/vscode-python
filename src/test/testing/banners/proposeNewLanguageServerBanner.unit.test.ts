// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { Extension } from 'vscode';
import { LanguageServerType } from '../../../client/activation/types';
import { IApplicationEnvironment, IApplicationShell } from '../../../client/common/application/types';
import { PYLANCE_EXTENSION_ID } from '../../../client/common/constants';
import { TryPylance } from '../../../client/common/experiments/groups';
import {
    IConfigurationService,
    IExperimentService,
    IExtensions,
    IPersistentState,
    IPersistentStateFactory,
    IPythonSettings
} from '../../../client/common/types';
import { Common, Pylance } from '../../../client/common/utils/localize';
import {
    getPylanceExtensionUri,
    ProposeLSStateKeys,
    ProposePylanceBanner
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
    let appEnv: typemoq.IMock<IApplicationEnvironment>;
    let settings: typemoq.IMock<IPythonSettings>;

    const message = Pylance.proposePylanceMessage();
    const yes = Pylance.tryItNow();
    const no = Common.bannerLabelNo();
    const later = Pylance.remindMeLater();

    setup(() => {
        config = typemoq.Mock.ofType<IConfigurationService>();
        settings = typemoq.Mock.ofType<IPythonSettings>();
        config.setup((x) => x.getSettings(typemoq.It.isAny())).returns(() => settings.object);
        appShell = typemoq.Mock.ofType<IApplicationShell>();
        appEnv = typemoq.Mock.ofType<IApplicationEnvironment>();
        appEnv.setup((x) => x.uriScheme).returns(() => 'scheme');
    });
    testData.forEach((t) => {
        test(`${t.inExperiment ? 'In' : 'Not in'} experiment and "python.languageServer": "${t.lsType}" should ${
            t.shouldShowBanner ? 'show' : 'not show'
        } banner`, async () => {
            settings.setup((x) => x.languageServer).returns(() => t.lsType);
            const testBanner = preparePopup(true, appShell.object, appEnv.object, config.object, t.inExperiment, false);
            const actual = await testBanner.shouldShowBanner();
            expect(actual).to.be.equal(t.shouldShowBanner, `shouldShowBanner() returned ${actual}`);
        });
    });
    testData.forEach((t) => {
        test(`When Pylance is installed, banner should not be shown when "python.languageServer": "${t.lsType}"`, async () => {
            settings.setup((x) => x.languageServer).returns(() => t.lsType);
            const testBanner = preparePopup(true, appShell.object, appEnv.object, config.object, t.inExperiment, true);
            const actual = await testBanner.shouldShowBanner();
            expect(actual).to.be.equal(false, `shouldShowBanner() returned ${actual}`);
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
        const testBanner = preparePopup(false, appShell.object, appEnv.object, config.object, true, false);
        await testBanner.showBanner();
        appShell.verifyAll();
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
        appShell.setup((a) => a.openUrl(getPylanceExtensionUri(appEnv.object))).verifiable(typemoq.Times.never());

        const testBanner = preparePopup(true, appShell.object, appEnv.object, config.object, true, false);
        await testBanner.showBanner();
        expect(testBanner.enabled).to.be.equal(false, 'Banner should be permanently disabled when user clicked No');
        appShell.verifyAll();
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
        appShell.setup((a) => a.openUrl(getPylanceExtensionUri(appEnv.object))).verifiable(typemoq.Times.never());

        const testBanner = preparePopup(true, appShell.object, appEnv.object, config.object, true, false);
        await testBanner.showBanner();
        expect(testBanner.enabled).to.be.equal(
            true,
            'Banner should not be permanently disabled when user clicked Later'
        );
        appShell.verifyAll();
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
        appShell.setup((a) => a.openUrl(getPylanceExtensionUri(appEnv.object))).verifiable(typemoq.Times.once());

        const testBanner = preparePopup(true, appShell.object, appEnv.object, config.object, true, false);
        await testBanner.showBanner();
        expect(testBanner.enabled).to.be.equal(false, 'Banner should be permanently disabled after opening store URL');
        appShell.verifyAll();
    });
});

function preparePopup(
    enabledValue: boolean,
    appShell: IApplicationShell,
    appEnv: IApplicationEnvironment,
    config: IConfigurationService,
    inExperiment: boolean,
    pylanceInstalled: boolean
): ProposePylanceBanner {
    const myfactory = typemoq.Mock.ofType<IPersistentStateFactory>();
    const val = typemoq.Mock.ofType<IPersistentState<boolean>>();
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

    const experiments = typemoq.Mock.ofType<IExperimentService>();
    experiments.setup((x) => x.inExperiment(TryPylance.experiment)).returns(() => Promise.resolve(inExperiment));

    const extensions = typemoq.Mock.ofType<IExtensions>();
    // tslint:disable-next-line: no-any
    const extension = typemoq.Mock.ofType<Extension<any>>();
    extensions
        .setup((x) => x.getExtension(PYLANCE_EXTENSION_ID))
        .returns(() => (pylanceInstalled ? extension.object : undefined));
    return new ProposePylanceBanner(appShell, appEnv, myfactory.object, config, experiments.object, extensions.object);
}

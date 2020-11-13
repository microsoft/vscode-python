// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert, expect } from 'chai';
import * as sinon from 'sinon';
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
    ProposePylanceBannerJedi
} from '../../../client/languageServices/proposeLanguageServerBannerJedi';

import * as Telemetry from '../../../client/telemetry';
import { EventName } from '../../../client/telemetry/constants';

interface IExperimentLsCombination {
    experiment: TryPylance ;
    lsType: LanguageServerType;
    shouldShowBanner: boolean;
}
const testData: IExperimentLsCombination[] = [
    // Expected Result is shouldShowBanner
    { experiment: TryPylance.jediPrompt1, lsType: LanguageServerType.None, shouldShowBanner: false },
    { experiment: TryPylance.jediPrompt1, lsType: LanguageServerType.Microsoft, shouldShowBanner: false },
    { experiment: TryPylance.jediPrompt1, lsType: LanguageServerType.Node, shouldShowBanner: false },
    { experiment: TryPylance.jediPrompt1, lsType: LanguageServerType.Jedi, shouldShowBanner: true },
    { experiment: TryPylance.jediPrompt2, lsType: LanguageServerType.None, shouldShowBanner: false },
    { experiment: TryPylance.jediPrompt2, lsType: LanguageServerType.Microsoft, shouldShowBanner: false },
    { experiment: TryPylance.jediPrompt2, lsType: LanguageServerType.Node, shouldShowBanner: false },
    { experiment: TryPylance.jediPrompt2, lsType: LanguageServerType.Jedi, shouldShowBanner: true }
];

suite('Jedi Propose Pylance Banner', () => {
    let config: typemoq.IMock<IConfigurationService>;
    let appShell: typemoq.IMock<IApplicationShell>;
    let appEnv: typemoq.IMock<IApplicationEnvironment>;
    let settings: typemoq.IMock<IPythonSettings>;
    let sendTelemetryStub: sinon.SinonStub;
    let telemetryEvent:
        | { eventName: EventName; properties: { userAction: string; experimentName: string } }
        | undefined;

    const message = 'Sample value1';
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

        sendTelemetryStub = sinon
            .stub(Telemetry, 'sendTelemetryEvent')
            .callsFake((eventName: EventName, _, properties: { userAction: string; experimentName: string }) => {
                telemetryEvent = {
                    eventName,
                    properties
                };
            });
    });

    teardown(() => {
        telemetryEvent = undefined;
        sinon.restore();
        Telemetry._resetSharedProperties();
    });

    testData.forEach((t) => {
        test(`${t.experiment ? 'In' : 'Not in'} experiment and "python.languageServer": "${t.lsType}" should ${
            t.shouldShowBanner ? 'show' : 'not show'
        } banner`, async () => {
            settings.setup((x) => x.languageServer).returns(() => t.lsType);
            const testBanner = preparePopup(true, appShell.object, appEnv.object, config.object, t.experiment, false);
            const actual = await testBanner.shouldShowBanner();
            expect(actual).to.be.equal(t.shouldShowBanner, `shouldShowBanner() returned ${actual}`);
        });
    });
    testData.forEach((t) => {
        test(`When Pylance is installed, banner should not be shown when "python.languageServer": "${t.lsType}"`, async () => {
            settings.setup((x) => x.languageServer).returns(() => t.lsType);
            const testBanner = preparePopup(true, appShell.object, appEnv.object, config.object, t.experiment, true);
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
        const testBanner = preparePopup(
            false,
            appShell.object,
            appEnv.object,
            config.object,
            TryPylance.jediPrompt1,
            false
        );
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

        settings.setup((x) => x.languageServer).returns(() => LanguageServerType.Jedi);

        const testBanner = preparePopup(
            true,
            appShell.object,
            appEnv.object,
            config.object,
            TryPylance.jediPrompt1,
            false
        );
        await testBanner.showBanner();

        expect(testBanner.enabled).to.be.equal(false, 'Banner should be permanently disabled when user clicked No');
        appShell.verifyAll();

        sinon.assert.calledOnce(sendTelemetryStub);
        assert.deepEqual(telemetryEvent, {
            eventName: EventName.LANGUAGE_SERVER_TRY_PYLANCE,
            properties: { userAction: 'no', experimentName: TryPylance.jediPrompt1 }
        });
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

        settings.setup((x) => x.languageServer).returns(() => LanguageServerType.Jedi);

        const testBanner = preparePopup(
            true,
            appShell.object,
            appEnv.object,
            config.object,
            TryPylance.jediPrompt1,
            false
        );
        await testBanner.showBanner();

        expect(testBanner.enabled).to.be.equal(
            true,
            'Banner should not be permanently disabled when user clicked Later'
        );
        appShell.verifyAll();

        sinon.assert.calledOnce(sendTelemetryStub);
        assert.deepEqual(telemetryEvent, {
            eventName: EventName.LANGUAGE_SERVER_TRY_PYLANCE,
            properties: {
                userAction: 'later',
                experimentName: TryPylance.jediPrompt1
            }
        });
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

        settings.setup((x) => x.languageServer).returns(() => LanguageServerType.Jedi);

        const testBanner = preparePopup(
            true,
            appShell.object,
            appEnv.object,
            config.object,
            TryPylance.jediPrompt1,
            false
        );
        await testBanner.showBanner();

        expect(testBanner.enabled).to.be.equal(false, 'Banner should be permanently disabled after opening store URL');
        appShell.verifyAll();

        sinon.assert.calledOnce(sendTelemetryStub);
        assert.deepEqual(telemetryEvent, {
            eventName: EventName.LANGUAGE_SERVER_TRY_PYLANCE,
            properties: {
                userAction: 'yes',
                experimentName: TryPylance.jediPrompt1
            }
        });
    });
});

function preparePopup(
    enabledValue: boolean,
    appShell: IApplicationShell,
    appEnv: IApplicationEnvironment,
    config: IConfigurationService,
    experiment: TryPylance,
    pylanceInstalled: boolean
): ProposePylanceBannerJedi {
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
    val.setup((a) => a.value).returns(() => enabledValue);
    myfactory
        .setup((a) =>
            a.createGlobalPersistentState(
                typemoq.It.isValue(ProposeLSStateKeys.ShowBannerJedi),
                typemoq.It.isValue(true)
            )
        )
        .returns(() => val.object);
    myfactory
        .setup((a) =>
            a.createGlobalPersistentState(
                typemoq.It.isValue(ProposeLSStateKeys.ShowBannerJedi),
                typemoq.It.isValue(false)
            )
        )
        .returns(() => val.object);

    const experiments = typemoq.Mock.ofType<IExperimentService>();
    experiments
        .setup((x) => x.inExperiment(TryPylance.jediPrompt1))
        .returns(() => Promise.resolve(experiment === TryPylance.jediPrompt1));

    experiments
        .setup((x) => x.getExperimentValue(TryPylance.jediPrompt1))
        .returns(() => Promise.resolve('Sample value1'));

    experiments
        .setup((x) => x.inExperiment(TryPylance.jediPrompt2))
        .returns(() => Promise.resolve(experiment === TryPylance.jediPrompt2));

    experiments
        .setup((x) => x.getExperimentValue(TryPylance.jediPrompt2))
        .returns(() => Promise.resolve('Sample value2'));

    const extensions = typemoq.Mock.ofType<IExtensions>();
    // tslint:disable-next-line: no-any
    const extension = typemoq.Mock.ofType<Extension<any>>();
    extensions
        .setup((x) => x.getExtension(PYLANCE_EXTENSION_ID))
        .returns(() => (pylanceInstalled ? extension.object : undefined));
    return new ProposePylanceBannerJedi(
        appShell,
        appEnv,
        myfactory.object,
        config,
        experiments.object,
        extensions.object
    );
}

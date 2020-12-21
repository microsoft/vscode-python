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
    IPythonSettings,
} from '../../../client/common/types';
import { Common, Pylance } from '../../../client/common/utils/localize';
import {
    getPylanceExtensionUri,
    ProposeLSStateKeys,
    ProposePylanceBanner,
} from '../../../client/languageServices/proposeLanguageServerBanner';
import * as Telemetry from '../../../client/telemetry';
import { EventName } from '../../../client/telemetry/constants';

interface IExperimentLsCombination {
    experiment?: TryPylance;
    lsType: LanguageServerType;
    shouldShowBanner: boolean;
}
const testData: IExperimentLsCombination[] = [
    { experiment: undefined, lsType: LanguageServerType.None, shouldShowBanner: false },
    { experiment: undefined, lsType: LanguageServerType.Microsoft, shouldShowBanner: false },
    { experiment: undefined, lsType: LanguageServerType.Node, shouldShowBanner: false },
    { experiment: undefined, lsType: LanguageServerType.Jedi, shouldShowBanner: false },

    { experiment: TryPylance.experiment, lsType: LanguageServerType.None, shouldShowBanner: true },
    { experiment: TryPylance.experiment, lsType: LanguageServerType.Microsoft, shouldShowBanner: true },
    { experiment: TryPylance.experiment, lsType: LanguageServerType.Node, shouldShowBanner: false },
    { experiment: TryPylance.experiment, lsType: LanguageServerType.Jedi, shouldShowBanner: false },

    { experiment: TryPylance.jediPrompt1, lsType: LanguageServerType.None, shouldShowBanner: false },
    { experiment: TryPylance.jediPrompt1, lsType: LanguageServerType.Microsoft, shouldShowBanner: false },
    { experiment: TryPylance.jediPrompt1, lsType: LanguageServerType.Node, shouldShowBanner: false },
    { experiment: TryPylance.jediPrompt1, lsType: LanguageServerType.Jedi, shouldShowBanner: true },

    { experiment: TryPylance.jediPrompt2, lsType: LanguageServerType.None, shouldShowBanner: false },
    { experiment: TryPylance.jediPrompt2, lsType: LanguageServerType.Microsoft, shouldShowBanner: false },
    { experiment: TryPylance.jediPrompt2, lsType: LanguageServerType.Node, shouldShowBanner: false },
    { experiment: TryPylance.jediPrompt2, lsType: LanguageServerType.Jedi, shouldShowBanner: true },
];

const expectedMessages = {
    [TryPylance.experiment]: Pylance.proposePylanceMessage(),
    [TryPylance.jediPrompt1]: 'Message for jediPrompt1',
    [TryPylance.jediPrompt2]: 'Message for jediPrompt2',
};

suite('Propose Pylance Banner', () => {
    let config: typemoq.IMock<IConfigurationService>;
    let appShell: typemoq.IMock<IApplicationShell>;
    let appEnv: typemoq.IMock<IApplicationEnvironment>;
    let settings: typemoq.IMock<IPythonSettings>;
    let sendTelemetryStub: sinon.SinonStub;
    let telemetryEvent: { eventName: EventName; properties: { userAction: string } } | undefined;

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
            .callsFake((eventName: EventName, _, properties: { userAction: string }) => {
                telemetryEvent = {
                    eventName,
                    properties,
                };
            });
    });

    teardown(() => {
        telemetryEvent = undefined;
        sinon.restore();
        Telemetry._resetSharedProperties();
    });

    testData.forEach((t) => {
        test(`${t.experiment} experiment and "python.languageServer": "${t.lsType}" should ${
            t.shouldShowBanner ? 'show' : 'not show'
        } banner`, async () => {
            settings.setup((x) => x.languageServer).returns(() => t.lsType);
            const testBanner = preparePopup(true, appShell.object, appEnv.object, config.object, t.experiment, false);
            const message = await testBanner.getPromptMessage();
            if (t.experiment) {
                expect(message).to.be.equal(
                    t.shouldShowBanner ? expectedMessages[t.experiment] : undefined,
                    `getPromptMessage() returned ${message}`,
                );
            } else {
                expect(message).to.be.equal(undefined, `message should be undefined`);
            }
        });
    });
    testData.forEach((t) => {
        test(`When Pylance is installed, banner should not be shown when "python.languageServer": "${t.lsType}"`, async () => {
            settings.setup((x) => x.languageServer).returns(() => t.lsType);
            const testBanner = preparePopup(true, appShell.object, appEnv.object, config.object, t.experiment, true);
            const message = await testBanner.getPromptMessage();
            expect(message).to.be.equal(undefined, `getPromptMessage() returned ${message}`);
        });
    });
    test('Do not show banner when it is disabled', async () => {
        settings.setup((x) => x.languageServer).returns(() => LanguageServerType.Microsoft);
        appShell
            .setup((a) =>
                a.showInformationMessage(
                    typemoq.It.isValue(expectedMessages[TryPylance.experiment]),
                    typemoq.It.isValue(yes),
                    typemoq.It.isValue(no),
                    typemoq.It.isValue(later),
                ),
            )
            .verifiable(typemoq.Times.never());
        const testBanner = preparePopup(
            false,
            appShell.object,
            appEnv.object,
            config.object,
            TryPylance.experiment,
            false,
        );
        await testBanner.showBanner();
        appShell.verifyAll();
    });
    test('Clicking No should disable the banner', async () => {
        settings.setup((x) => x.languageServer).returns(() => LanguageServerType.Microsoft);
        appShell
            .setup((a) =>
                a.showInformationMessage(
                    typemoq.It.isValue(expectedMessages[TryPylance.experiment]),
                    typemoq.It.isValue(yes),
                    typemoq.It.isValue(no),
                    typemoq.It.isValue(later),
                ),
            )
            .returns(async () => no)
            .verifiable(typemoq.Times.once());
        appShell.setup((a) => a.openUrl(getPylanceExtensionUri(appEnv.object))).verifiable(typemoq.Times.never());

        const testBanner = preparePopup(
            true,
            appShell.object,
            appEnv.object,
            config.object,
            TryPylance.experiment,
            false,
        );
        await testBanner.showBanner();

        expect(testBanner.enabled).to.be.equal(false, 'Banner should be permanently disabled when user clicked No');
        appShell.verifyAll();

        sinon.assert.calledOnce(sendTelemetryStub);
        assert.deepEqual(telemetryEvent, {
            eventName: EventName.LANGUAGE_SERVER_TRY_PYLANCE,
            properties: { userAction: 'no' },
        });
    });
    test('Clicking Later should disable banner in session', async () => {
        settings.setup((x) => x.languageServer).returns(() => LanguageServerType.Microsoft);
        appShell
            .setup((a) =>
                a.showInformationMessage(
                    typemoq.It.isValue(expectedMessages[TryPylance.experiment]),
                    typemoq.It.isValue(yes),
                    typemoq.It.isValue(no),
                    typemoq.It.isValue(later),
                ),
            )
            .returns(async () => later)
            .verifiable(typemoq.Times.once());
        appShell.setup((a) => a.openUrl(getPylanceExtensionUri(appEnv.object))).verifiable(typemoq.Times.never());

        const testBanner = preparePopup(
            true,
            appShell.object,
            appEnv.object,
            config.object,
            TryPylance.experiment,
            false,
        );
        await testBanner.showBanner();

        expect(testBanner.enabled).to.be.equal(
            true,
            'Banner should not be permanently disabled when user clicked Later',
        );
        appShell.verifyAll();

        sinon.assert.calledOnce(sendTelemetryStub);
        assert.deepEqual(telemetryEvent, {
            eventName: EventName.LANGUAGE_SERVER_TRY_PYLANCE,
            properties: {
                userAction: 'later',
            },
        });
    });
    test('Clicking Yes opens the extension marketplace entry', async () => {
        settings.setup((x) => x.languageServer).returns(() => LanguageServerType.Microsoft);
        appShell
            .setup((a) =>
                a.showInformationMessage(
                    typemoq.It.isValue(expectedMessages[TryPylance.experiment]),
                    typemoq.It.isValue(yes),
                    typemoq.It.isValue(no),
                    typemoq.It.isValue(later),
                ),
            )
            .returns(async () => yes)
            .verifiable(typemoq.Times.once());
        appShell.setup((a) => a.openUrl(getPylanceExtensionUri(appEnv.object))).verifiable(typemoq.Times.once());

        const testBanner = preparePopup(
            true,
            appShell.object,
            appEnv.object,
            config.object,
            TryPylance.experiment,
            false,
        );
        await testBanner.showBanner();

        expect(testBanner.enabled).to.be.equal(false, 'Banner should be permanently disabled after opening store URL');
        appShell.verifyAll();

        sinon.assert.calledOnce(sendTelemetryStub);
        assert.deepEqual(telemetryEvent, {
            eventName: EventName.LANGUAGE_SERVER_TRY_PYLANCE,
            properties: {
                userAction: 'yes',
            },
        });
    });
});

function preparePopup(
    enabledValue: boolean,
    appShell: IApplicationShell,
    appEnv: IApplicationEnvironment,
    config: IConfigurationService,
    experiment: TryPylance | undefined,
    pylanceInstalled: boolean,
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
            a.createGlobalPersistentState(typemoq.It.isValue(ProposeLSStateKeys.ShowBanner), typemoq.It.isValue(true)),
        )
        .returns(() => {
            return val.object;
        });
    myfactory
        .setup((a) =>
            a.createGlobalPersistentState(typemoq.It.isValue(ProposeLSStateKeys.ShowBanner), typemoq.It.isValue(false)),
        )
        .returns(() => {
            return val.object;
        });

    const experiments = typemoq.Mock.ofType<IExperimentService>();
    Object.values(TryPylance).forEach((exp) => {
        experiments.setup((x) => x.inExperiment(exp)).returns(() => Promise.resolve(exp === experiment));
        if (exp !== TryPylance.experiment) {
            experiments.setup((x) => x.getExperimentValue(exp)).returns(() => Promise.resolve(expectedMessages[exp]));
        }
    });

    const extensions = typemoq.Mock.ofType<IExtensions>();

    const extension = typemoq.Mock.ofType<Extension<any>>();
    extensions
        .setup((x) => x.getExtension(PYLANCE_EXTENSION_ID))
        .returns(() => (pylanceInstalled ? extension.object : undefined));
    return new ProposePylanceBanner(appShell, appEnv, myfactory.object, config, experiments.object, extensions.object);
}

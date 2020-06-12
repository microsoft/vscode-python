// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any max-func-body-length

import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { IApplicationEnvironment, IApplicationShell } from '../../../client/common/application/types';
import { IConfigurationService, IPersistentState, IPersistentStateFactory } from '../../../client/common/types';
import {
    ProposeLanguageServerBanner,
    ProposeLSStateKeys
} from '../../../client/languageServices/proposeLanguageServerBanner';

suite('Propose New Language Server Banner', () => {
    let config: typemoq.IMock<IConfigurationService>;
    let appEnvironment: typemoq.IMock<IApplicationEnvironment>;
    let appShell: typemoq.IMock<IApplicationShell>;
    const message =
        'Try out Preview of our new Python Language Server to get richer and faster IntelliSense completions, and syntax errors as you type.';
    const yes = 'Try it now';
    const no = 'No thanks';
    const later = 'Remind me Later';

    setup(() => {
        config = typemoq.Mock.ofType<IConfigurationService>();
        appEnvironment = typemoq.Mock.ofType<IApplicationEnvironment>();
        appShell = typemoq.Mock.ofType<IApplicationShell>();
    });
    test('Is debugger enabled upon creation?', async () => {
        const enabledValue = true;
        const testBanner = preparePopup(enabledValue, 100, appEnvironment.object, appShell.object, config.object);
        const enabled = await testBanner.isEnabled();
        expect(enabled).to.be.equal(true, 'Sampling 100/100 should always enable the banner.');
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
        const enabled = true;
        const testBanner = preparePopup(enabled, 0, appEnvironment.object, appShell.object, config.object);
        testBanner.showBanner().ignoreErrors();
    });
    test('shouldShowBanner must return false when Banner is implicitly disabled by sampling', async () => {
        appEnvironment.setup((x) => x.channel).returns(() => 'stable');
        const testBanner = preparePopup(true, 0, appEnvironment.object, appShell.object, config.object);
        const enabled = await testBanner.isEnabled();
        expect(enabled).to.be.equal(false, 'We implicitly disabled the banner, it should never show.');
    });
    test('shouldShowBanner must return true when channel is insiders', async () => {
        appEnvironment.setup((x) => x.channel).returns(() => 'insiders');
        const testBanner = preparePopup(false, 100, appEnvironment.object, appShell.object, config.object);
        const enabled = await testBanner.isEnabled();
        expect(enabled).to.be.equal(true, 'Banner in insiders channel did not show.');
    });
    test('shouldShowBanner must return false when Banner is explicitly disabled', async () => {
        const enabled = true;
        appEnvironment.setup((x) => x.channel).returns(() => 'stable');
        const testBanner = preparePopup(enabled, 100, appEnvironment.object, appShell.object, config.object);

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
    appEnvironment: IApplicationEnvironment,
    appShell: IApplicationShell,
    config: IConfigurationService
): ProposeLanguageServerBanner {
    const myfactory: typemoq.IMock<IPersistentStateFactory> = typemoq.Mock.ofType<IPersistentStateFactory>();

    setupPersistentState(myfactory, ProposeLSStateKeys.ProposeLSBanner, enabledValue);
    return new ProposeLanguageServerBanner(appEnvironment, appShell, myfactory.object, config, sampleValue);
}

function setupPersistentState(myfactory: typemoq.IMock<IPersistentStateFactory>, name: string, value: boolean): void {
    const val: typemoq.IMock<IPersistentState<boolean>> = typemoq.Mock.ofType<IPersistentState<boolean>>();
    val.setup((a) => a.updateValue(typemoq.It.isValue(true))).returns(() => {
        value = true;
        return Promise.resolve();
    });
    val.setup((a) => a.updateValue(typemoq.It.isValue(false))).returns(() => {
        value = false;
        return Promise.resolve();
    });
    val.setup((a) => a.value).returns(() => {
        return value;
    });
    myfactory
        .setup((a) => a.createGlobalPersistentState(typemoq.It.isValue(name), typemoq.It.isValue(true)))
        .returns(() => {
            return val.object;
        });
    myfactory
        .setup((a) => a.createGlobalPersistentState(typemoq.It.isValue(name), typemoq.It.isValue(false)))
        .returns(() => {
            return val.object;
        });
}

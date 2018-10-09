// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as localize from '../../utils/localize';

// Defines a Mocha test suite to group tests of similar kind together
suite('localize tests', () => {

    test('keys', done => {
        const val = localize.LanguageServiceSurveyBanner.bannerMessage();
        assert.equal(val, 'Can you please take 2 minutes to tell us how the Python Language Server is working for you?', 'LanguageServiceSurveyBanner string doesnt match');
        done();
    });

    test('keys italian', done => {
        // Force a config change
        process.env.VSCODE_NLS_CONFIG = '{ "locale": "it" }';

        const val = localize.LanguageServiceSurveyBanner.bannerLabelYes();
        assert.equal(val, 'Sì, prenderò il sondaggio ora', 'bannerLabelYes is not being translated');
        done();
    });
});

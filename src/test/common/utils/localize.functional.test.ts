// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../../../client/common/constants';
import * as localize from '../../../client/common/utils/localize';
import * as localizeHelpers from '../../../client/common/utils/localizeHelpers';

const defaultNLSFile = path.join(EXTENSION_ROOT_DIR, 'package.nls.json');

// Defines a Mocha test suite to group tests of similar kind together
suite('Localization', () => {
    // Note: We use package.nls.json by default for tests.  Use the
    // setLocale() helper to switch to a different locale.

    let localeFiles: string[];
    let nls_orig: string | undefined;

    setup(() => {
        localeFiles = [];

        nls_orig = process.env.VSCODE_NLS_CONFIG;
        setLocale('en-us');

        // Ensure each test starts fresh.
        localizeHelpers._resetCollections();
    });

    teardown(() => {
        if (nls_orig) {
            process.env.VSCODE_NLS_CONFIG = nls_orig;
        } else {
            delete process.env.VSCODE_NLS_CONFIG;
        }

        const filenames = localeFiles;
        localeFiles = [];
        for (const filename of filenames) {
            fs.unlinkSync(filename);
        }
    });

    function addLocale(locale: string, nls: Record<string, string>) {
        const filename = addLocaleFile(locale, nls);
        localeFiles.push(filename);
    }

    test('keys', (done) => {
        const val = localize.ExtensionSurveyBanner.bannerMessage();
        assert.equal(
            val,
            'Can you please take 2 minutes to tell us how the Python extension is working for you?',
            'LanguageService string doesnt match',
        );
        done();
    });

    test('keys italian', (done) => {
        // Force a config change
        setLocale('it');

        const val = localize.ExtensionSurveyBanner.bannerLabelYes();
        assert.equal(val, 'Sì, prenderò il sondaggio ora', 'bannerLabelYes is not being translated');
        done();
    });

    test('key found for locale', (done) => {
        addLocale('spam', {
            'debug.selectConfigurationTitle': '???',
            'Common.gotIt': '!!!',
        });
        setLocale('spam');

        const title = localize.DebugConfigStrings.selectConfiguration.title();
        const gotIt = localize.Common.gotIt();

        assert.equal(title, '???', 'not used');
        assert.equal(gotIt, '!!!', 'not used');
        done();
    });

    test('key not found for locale (default used)', (done) => {
        addLocale('spam', {
            'debug.selectConfigurationTitle': '???',
        });
        setLocale('spam');

        const gotIt = localize.Common.gotIt();

        assert.equal(gotIt, 'Got it!', `default not used (got ${gotIt})`);
        done();
    });

    test('keys exist', (done) => {
        // Read in the JSON object for the package.nls.json
        const nlsCollection = getDefaultCollection();

        // Now match all of our namespace entries to our nls entries
        useEveryLocalization(localize);

        // Now verify all of the asked for keys exist
        const askedFor = localizeHelpers._getAskedForCollection();
        const missing: Record<string, string> = {};
        Object.keys(askedFor).forEach((key: string) => {
            // Now check that this key exists somewhere in the nls collection
            if (!nlsCollection[key]) {
                missing[key] = askedFor[key];
            }
        });

        // If any missing keys, output an error
        const missingKeys = Object.keys(missing);
        if (missingKeys && missingKeys.length > 0) {
            let message = 'Missing keys. Add the following to package.nls.json:\n';
            missingKeys.forEach((k: string) => {
                message = message.concat(`\t"${k}" : "${missing[k]}",\n`);
            });
            assert.fail(message);
        }

        done();
    });

    test('all keys used', function (done) {
        // TODO: Unused keys need to be cleaned up.

        this.skip();
        //test('all keys used', done => {
        const nlsCollection = getDefaultCollection();
        useEveryLocalization(localize);

        // Now verify all of the asked for keys exist
        const askedFor = localizeHelpers._getAskedForCollection();
        const extra: Record<string, string> = {};
        Object.keys(nlsCollection).forEach((key: string) => {
            // Now check that this key exists somewhere in the nls collection
            if (askedFor[key]) {
                return;
            }
            extra[key] = nlsCollection[key];
        });

        // If any missing keys, output an error
        const extraKeys = Object.keys(extra);
        if (extraKeys && extraKeys.length > 0) {
            let message = 'Unused keys. Remove the following from package.nls.json:\n';
            extraKeys.forEach((k: string) => {
                message = message.concat(`\t"${k}" : "${extra[k]}",\n`);
            });
            assert.fail(message);
        }

        done();
    });
});

function addLocaleFile(locale: string, nls: Record<string, string>) {
    const filename = path.join(EXTENSION_ROOT_DIR, `package.nls.${locale}.json`);
    if (fs.existsSync(filename)) {
        throw Error(`NLS file ${filename} already exists`);
    }
    const contents = JSON.stringify(nls);
    fs.writeFileSync(filename, contents);
    return filename;
}

function setLocale(locale: string) {
    let nls: Record<string, string>;
    if (process.env.VSCODE_NLS_CONFIG) {
        nls = JSON.parse(process.env.VSCODE_NLS_CONFIG);
        nls.locale = locale;
    } else {
        nls = { locale: locale };
    }
    process.env.VSCODE_NLS_CONFIG = JSON.stringify(nls);
}

function getDefaultCollection() {
    if (!fs.existsSync(defaultNLSFile)) {
        throw Error('package.nls.json is missing');
    }
    const contents = fs.readFileSync(defaultNLSFile, 'utf8');
    return JSON.parse(contents);
}

function useEveryLocalization(topns: any) {
    // Read all of the namespaces from the localize import.
    const entries = Object.keys(topns);

    // Now match all of our namespace entries to our nls entries.
    entries.forEach((e: string) => {
        // @ts-ignore
        if (typeof topns[e] === 'function') {
            return;
        }
        // It must be a namespace.
        useEveryLocalizationInNS(topns[e]);
    });
}

function useEveryLocalizationInNS(ns: any) {
    // The namespace should have functions inside of it.
    // @ts-ignore
    const props = Object.keys(ns);

    // Run every function and cover every sub-namespace.
    // This should fill up our "asked-for keys" collection.
    props.forEach((key: string) => {
        if (typeof ns[key] === 'function') {
            const func = ns[key];
            func();
        } else {
            useEveryLocalizationInNS(ns[key]);
        }
    });
}

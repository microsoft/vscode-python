// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { EXTENSION_ROOT_DIR } from '../../../client/common/constants';
import * as localize from '../../../client/common/utils/localize';

const defaultNLSFile = path.join(EXTENSION_ROOT_DIR, 'package.nls.json');

// Defines a Mocha test suite to group tests of similar kind together
suite('Localization', () => {
    // Note: We use package.nls.json by default for tests.  Use the
    // setLocale() helper to switch to a different locale.

    let nls_orig: string | undefined;

    setup(() => {
        nls_orig = process.env.VSCODE_NLS_CONFIG;
        setLocale('en-us');
    });

    teardown(() => {
        if (nls_orig) {
            process.env.VSCODE_NLS_CONFIG = nls_orig;
        } else {
            delete process.env.VSCODE_NLS_CONFIG;
        }
    });

    test('keys', done => {
        const val = localize.LanguageService.bannerMessage();
        assert.equal(val, 'Can you please take 2 minutes to tell us how the Python Language Server is working for you?', 'LanguageService string doesnt match');
        done();
    });

    test('keys italian', done => {
        // Force a config change
        setLocale('it');

        const val = localize.LanguageService.bannerLabelYes();
        assert.equal(val, 'Sì, prenderò il sondaggio ora', 'bannerLabelYes is not being translated');
        done();
    });

    test('keys exist', done => {
        // Read in the JSON object for the package.nls.json
        const nlsCollection = getDefaultCollection();

        // Now match all of our namespace entries to our nls entries
        useEveryLocalization(localize);

        // Now verify all of the asked for keys exist
        const askedFor = localize._getAskedForCollection();
        const missing = {};
        Object.keys(askedFor).forEach((key: string) => {
            // Now check that this key exists somewhere in the nls collection
            // tslint:disable-next-line:no-any
            if (!(nlsCollection as any)[key]) {
                // tslint:disable-next-line:no-any
                (missing as any)[key] = askedFor[key];
            }
        });

        // If any missing keys, output an error
        const missingKeys = Object.keys(missing);
        if (missingKeys && missingKeys.length > 0) {
            let message = 'Missing keys. Add the following to package.nls.json:\n';
            missingKeys.forEach((k: string) => {
                // tslint:disable-next-line:no-any
                message = message.concat(`\t"${k}" : "${(missing as any)[k]}",\n`);
            });
            assert.fail(message);
        }

        done();
    });

    test('all keys used', function(done) {
        // tslint:disable-next-line:no-suspicious-comment
        // TODO: Unused keys need to be cleaned up.
        // tslint:disable-next-line:no-invalid-this
        this.skip();
    //test('all keys used', done => {
        const nlsCollection = getDefaultCollection();
        useEveryLocalization(localize);

        // Now verify all of the asked for keys exist
        const askedFor = localize._getAskedForCollection();
        // tslint:disable-next-line:no-any
        const extra: any = {};
        Object.keys(nlsCollection).forEach((key: string) => {
            // Now check that this key exists somewhere in the nls collection
            if (askedFor[key]) {
                return;
            }
            if (key.toLowerCase().indexOf('datascience') >= 0) {
                return;
            }
            extra[key] = nlsCollection[key];
        });

        // If any missing keys, output an error
        const extraKeys = Object.keys(extra);
        if (extraKeys && extraKeys.length > 0) {
            let message = 'Unused keys. Remove the following from package.nls.json:\n';
            extraKeys.forEach((k: string) => {
                // tslint:disable-next-line:no-any
                message = message.concat(`\t"${k}" : "${extra[k]}",\n`);
            });
            assert.fail(message);
        }

        done();
    });
});

function setLocale(locale: string) {
    // tslint:disable-next-line:no-any
    let nls: any;
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

// tslint:disable-next-line:no-any
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

// tslint:disable-next-line:no-any
function useEveryLocalizationInNS(ns: any) {
    // The namespace should have functions inside of it.
    // @ts-ignore
    const funcs = Object.keys(ns);

    // Run every function; this should fill up our "asked-for keys" collection.
    funcs.forEach((key: string) => {
        const func = ns[key];
        func();
    });
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length

import { expect } from 'chai';
import * as os from 'os';
import * as path from 'path';
import { PathUtils } from '../../../client/common/platform/pathUtils';

const IS_WINDOWS = /^win/.test(process.platform);

suite('FileSystem - PathUtils', () => {
    let utils: PathUtils;
    setup(() => {
        utils = new PathUtils(IS_WINDOWS);
    });

    suite('home', () => {
        const expected = os.homedir();

        test('matches node', () => {
            expect(utils.home).to.equal(expected);
        });
    });

    suite('delimiter', () => {
        test('matches node', () => {
            expect(utils.delimiter).to.be.equal(path.delimiter);
        });
    });

    suite('separator', () => {
        test('matches node', () => {
            expect(utils.separator).to.be.equal(path.sep);
        });
    });

    suite('getPathVariableName', () => {
        const expected = IS_WINDOWS ? 'Path' : 'PATH';

        test('matches platform', () => {
            const envVar = utils.getPathVariableName();

            expect(envVar).to.equal(expected);
        });
    });

    suite('getDisplayName', () => {
        const relname = path.join('spam', 'eggs', 'spam.py');
        const cwd = path.resolve(path.sep, 'x', 'y', 'z');

        test('filename matches CWD', () => {
            const filename = path.join(cwd, relname);
            const expected = `.${path.sep}${relname}`;

            const display = utils.getDisplayName(filename, cwd);

            expect(display).to.equal(expected);
        });

        test('filename does not match CWD', () => {
            const filename = path.resolve(cwd, '..', relname);
            const expected = filename;

            const display = utils.getDisplayName(filename, cwd);

            expect(display).to.equal(expected);
        });

        test('filename matches home dir, not cwd', () => {
            const filename = path.join(os.homedir(), relname);
            const expected = path.join('~', relname);

            const display = utils.getDisplayName(filename, cwd);

            expect(display).to.equal(expected);
        });

        test('filename matches home dir', () => {
            const filename = path.join(os.homedir(), relname);
            const expected = path.join('~', relname);

            const display = utils.getDisplayName(filename);

            expect(display).to.equal(expected);
        });

        test('filename does not match home dir', () => {
            const filename = relname;
            const expected = filename;

            const display = utils.getDisplayName(filename);

            expect(display).to.equal(expected);
        });
    });

    suite('basename', () => {
        test('with dirname', () => {
            const filename = path.join('spam', 'eggs', 'spam.py');
            const expected = 'spam.py';

            const basename = utils.basename(filename);

            expect(basename).to.equal(expected);
        });

        test('without dirname', () => {
            const filename = 'spam.py';
            const expected = filename;

            const basename = utils.basename(filename);

            expect(basename).to.equal(expected);
        });
    });
});

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length

import { expect } from 'chai';
import * as os from 'os';
import * as path from 'path';
import {
    Executables,
    FileSystemPaths,
    FileSystemPathUtils
} from '../../../client/common/platform/fs-paths';

const IS_WINDOWS = /^win/.test(process.platform);

suite('FileSystem - Paths', () => {
    let paths: FileSystemPaths;
    setup(() => {
        paths = FileSystemPaths.withDefaults();
    });

    suite('separator', () => {
        test('matches node', () => {
            expect(paths.sep).to.be.equal(path.sep);
        });
    });

    suite('basename', () => {
        test('with dirname', () => {
            const filename = path.join('spam', 'eggs', 'spam.py');
            const expected = 'spam.py';

            const basename = paths.basename(filename);

            expect(basename).to.equal(expected);
        });

        test('without dirname', () => {
            const filename = 'spam.py';
            const expected = filename;

            const basename = paths.basename(filename);

            expect(basename).to.equal(expected);
        });
    });

    suite('normalize', () => {
        test('noop', () => {
            const filename = path.join('spam', 'eggs', 'spam.py');
            const expected = filename;

            const norm = paths.normalize(filename);

            expect(norm).to.equal(expected);
        });

        test('pathological', () => {
            const filename = path.join(path.sep, 'spam', '..', 'eggs', '.', 'spam.py');
            const expected = path.join(path.sep, 'eggs', 'spam.py');

            const norm = paths.normalize(filename);

            expect(norm).to.equal(expected);
        });

        test('relative to CWD', () => {
            const filename = path.join('..', 'spam', 'eggs', 'spam.py');
            const expected = filename;

            const norm = paths.normalize(filename);

            expect(norm).to.equal(expected);
        });

        test('parent of root fails', () => {
            const filename = path.join(path.sep, '..');
            const expected = filename;

            const norm = paths.normalize(filename);

            expect(norm).to.equal(expected);
        });
    });
});

suite('FileSystem - Executables', () => {
    let execs: Executables;
    setup(() => {
        execs = Executables.withDefaults();
    });

    suite('delimiter', () => {
        test('matches node', () => {
            expect(execs.delimiter).to.be.equal(path.delimiter);
        });
    });

    suite('getPathVariableName', () => {
        const expected = IS_WINDOWS ? 'Path' : 'PATH';

        test('matches platform', () => {
            expect(execs.envVar).to.equal(expected);
        });
    });
});

suite('FileSystem - Path Utils', () => {
    let utils: FileSystemPathUtils;
    setup(() => {
        utils = FileSystemPathUtils.withDefaults();
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
});

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length chai-vague-errors

import { expect } from 'chai';
import * as os from 'os';
import * as path from 'path';
// prettier-ignore
import {
    Executables,
    FileSystemPaths,
    FileSystemPathUtils
} from '../../../client/common/platform/fs-paths';
// prettier-ignore
import {
    fixPath, FSFixture, OSX, SUPPORTS_SYMLINKS, WINDOWS as IS_WINDOWS
} from './utils';

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

    suite('dirname', () => {
        test('with dirname', () => {
            const filename = path.join('spam', 'eggs', 'spam.py');
            const expected = path.join('spam', 'eggs');

            const basename = paths.dirname(filename);

            expect(basename).to.equal(expected);
        });

        test('without dirname', () => {
            const filename = 'spam.py';
            const expected = '.';

            const basename = paths.dirname(filename);

            expect(basename).to.equal(expected);
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

    suite('join', () => {
        test('parts get joined by path.sep', () => {
            const expected = path.join('x', 'y', 'z', 'spam.py');

            // prettier-ignore
            const result = paths.join(
                'x',
                path.sep === '\\' ? 'y\\z' : 'y/z',
                'spam.py'
            );

            expect(result).to.equal(expected);
        });
    });

    suite('normCase', () => {
        test('forward-slash', () => {
            const filename = 'X/Y/Z/SPAM.PY';
            const expected = IS_WINDOWS ? 'X\\Y\\Z\\SPAM.PY' : filename;

            const result = paths.normCase(filename);

            expect(result).to.equal(expected);
        });

        test('backslash is not changed', () => {
            const filename = 'X\\Y\\Z\\SPAM.PY';
            const expected = filename;

            const result = paths.normCase(filename);

            expect(result).to.equal(expected);
        });

        test('lower-case', () => {
            const filename = 'x\\y\\z\\spam.py';
            const expected = IS_WINDOWS ? 'X\\Y\\Z\\SPAM.PY' : filename;

            const result = paths.normCase(filename);

            expect(result).to.equal(expected);
        });

        test('upper-case stays upper-case', () => {
            const filename = 'X\\Y\\Z\\SPAM.PY';
            const expected = 'X\\Y\\Z\\SPAM.PY';

            const result = paths.normCase(filename);

            expect(result).to.equal(expected);
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
    let fix: FSFixture;
    setup(() => {
        utils = FileSystemPathUtils.withDefaults();
        fix = new FSFixture();
    });

    suite('arePathsSame', () => {
        test('identical', () => {
            const filename = 'x/y/z/spam.py';

            const result = utils.arePathsSame(filename, filename);

            expect(result).to.equal(true);
        });

        test('not the same', () => {
            const file1 = 'x/y/z/spam.py';
            const file2 = 'a/b/c/spam.py';

            const result = utils.arePathsSame(file1, file2);

            expect(result).to.equal(false);
        });

        test('with different separators', () => {
            const file1 = 'x/y/z/spam.py';
            const file2 = 'x\\y\\z\\spam.py';
            const expected = IS_WINDOWS;

            const result = utils.arePathsSame(file1, file2);

            expect(result).to.equal(expected);
        });

        test('with different case', () => {
            const file1 = 'x/y/z/spam.py';
            const file2 = 'x/Y/z/Spam.py';
            const expected = IS_WINDOWS;

            const result = utils.arePathsSame(file1, file2);

            expect(result).to.equal(expected);
        });
    });

    suite('getRealPath', () => {
        const prevCwd = process.cwd();
        let cwd: string;
        setup(async function() {
            if (OSX) {
                // tslint:disable-next-line:no-suspicious-comment
                // TODO(GH-8995) These tests are failing on Mac, so
                // we are temporarily disabling it.
                // tslint:disable-next-line:no-invalid-this
                return this.skip();
            }
            cwd = await fix.createDirectory('x/y/z');
            process.chdir(cwd);
        });
        teardown(() => {
            process.chdir(prevCwd);
        });

        test('basename-only', async () => {
            const expected = await fix.createFile('x/y/z/spam.py');

            const resolved = await utils.getRealPath('spam.py');

            expect(resolved).to.equal(expected);
        });

        test('absolute', async () => {
            const filename = await fix.createFile('spam.py');
            const expected = filename;

            const resolved = await utils.getRealPath(filename);

            expect(resolved).to.equal(expected);
        });

        test('relative', async () => {
            const expected = await fix.createFile('x/y/z/w/spam.py');
            const relpath = fixPath('./w/spam.py');

            const resolved = await utils.getRealPath(relpath);

            expect(resolved).to.equal(expected);
        });

        test('parent', async () => {
            const expected = await fix.resolve('x/y');

            const resolved = await utils.getRealPath('..');

            expect(resolved).to.equal(expected);
        });

        test('cousin', async () => {
            const expected = await fix.createFile('x/w/spam.py');
            const relpath = fixPath('../../w/spam.py');

            const resolved = await utils.getRealPath(relpath);

            expect(resolved).to.equal(expected);
        });

        test('does not exist', async () => {
            const resolved = await utils.getRealPath('spam.py');

            // The original path was returned unchanged.
            expect(resolved).to.equal('spam.py'); // instead of <TMP>/x/y/z/spam.py
        });

        test('directory does not exist', async () => {
            const relpath = fixPath('../../w/spam.py');

            const resolved = await utils.getRealPath(relpath);

            // The original path was returned unchanged.
            expect(resolved).to.equal(relpath); // instead of <TMP>/x/w/spam.py
        });

        test('symlink', async function() {
            if (!SUPPORTS_SYMLINKS) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }
            const expected = await fix.createFile('spam.py');
            await fix.createSymlink('x/y/z/eggs.py', expected);

            const resolved = await utils.getRealPath('eggs.py');

            expect(resolved).to.equal(expected);
        });

        test('symlink chain', async function() {
            if (!SUPPORTS_SYMLINKS) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }
            const expected = await fix.createFile('w/spam.py');
            const symlink1 = await fix.createSymlink('x/y/spam.py', expected);
            await fix.createSymlink('x/y/z/eggs.py', symlink1);

            const resolved = await utils.getRealPath('eggs.py');

            expect(resolved).to.equal(expected);
        });

        test('symlink (target does not exist)', async function() {
            if (!SUPPORTS_SYMLINKS) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }
            const filename = await fix.resolve('spam.py');
            await fix.createSymlink('x/y/z/eggs.py', filename);

            const resolved = await utils.getRealPath('eggs.py');

            // The original path was returned unchanged.
            expect(resolved).to.equal('eggs.py'); // instead of <TMP>/spam.py
        });

        test('mixed', async function() {
            if (!SUPPORTS_SYMLINKS) {
                // tslint:disable-next-line:no-invalid-this
                this.skip();
            }
            const expected = await fix.createFile('x/y/w/eggs.py');
            await fix.createSymlink('x/w/spam.py', expected);
            const relpath = fixPath('../../w/spam.py');

            const resolved = await utils.getRealPath(relpath);

            expect(resolved).to.equal(expected);
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
});

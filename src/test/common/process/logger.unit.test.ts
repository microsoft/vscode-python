// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';

import untildify = require('untildify');
import { WorkspaceFolder } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { ProcessLogger } from '../../../client/common/process/logger';
import { Logging } from '../../../client/common/utils/localize';
import { getOSType, OSType } from '../../../client/common/utils/platform';
import * as logging from '../../../client/logging';

suite('ProcessLogger suite', () => {
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let logger: ProcessLogger;
    let traceLogStub: sinon.SinonStub;

    suiteSetup(() => {
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        workspaceService
            .setup((w) => w.workspaceFolders)
            .returns(() => [({ uri: { fsPath: path.join('path', 'to', 'workspace') } } as unknown) as WorkspaceFolder]);
        logger = new ProcessLogger(workspaceService.object);
    });

    setup(() => {
        traceLogStub = sinon.stub(logging, 'traceLog');
    });

    teardown(() => {
        sinon.restore();
    });

    test('Logger displays the process command, arguments and current working directory in the output channel', async () => {
        const options = { cwd: path.join('debug', 'path') };
        logger.logProcess('test', ['--foo', '--bar'], options);

        sinon.assert.calledWithExactly(traceLogStub, `> test --foo --bar`);
        sinon.assert.calledWithExactly(traceLogStub, `${Logging.currentWorkingDirectory} ${options.cwd}`);
    });

    test('Logger adds quotes around arguments if they contain spaces', async () => {
        const options = { cwd: path.join('debug', 'path') };
        logger.logProcess('test', ['--foo', '--bar', 'import test'], options);

        sinon.assert.calledWithExactly(traceLogStub, `> test --foo --bar "import test"`);
        sinon.assert.calledWithExactly(
            traceLogStub,
            `${Logging.currentWorkingDirectory} ${path.join('debug', 'path')}`,
        );
    });

    test('Logger preserves quotes around arguments if they contain spaces', async () => {
        const options = { cwd: path.join('debug', 'path') };
        logger.logProcess('test', ['--foo', '--bar', '"import test"'], options);

        sinon.assert.calledWithExactly(traceLogStub, `> test --foo --bar "import test"`);
        sinon.assert.calledWithExactly(
            traceLogStub,
            `${Logging.currentWorkingDirectory} ${path.join('debug', 'path')}`,
        );
    });

    test('Logger converts single quotes around arguments to double quotes if they contain spaces', async () => {
        const options = { cwd: path.join('debug', 'path') };
        logger.logProcess('test', ['--foo', '--bar', "'import test'"], options);

        sinon.assert.calledWithExactly(traceLogStub, `> test --foo --bar "import test"`);
        sinon.assert.calledWithExactly(
            traceLogStub,
            `${Logging.currentWorkingDirectory} ${path.join('debug', 'path')}`,
        );
    });

    test('Logger removes single quotes around arguments if they do not contain spaces', async () => {
        const options = { cwd: path.join('debug', 'path') };
        logger.logProcess('test', ['--foo', '--bar', "'importtest'"], options);

        sinon.assert.calledWithExactly(traceLogStub, `> test --foo --bar importtest`);
        sinon.assert.calledWithExactly(
            traceLogStub,
            `${Logging.currentWorkingDirectory} ${path.join('debug', 'path')}`,
        );
    });

    test('Logger replaces the path/to/home with ~ in the current working directory', async () => {
        const options = { cwd: path.join(untildify('~'), 'debug', 'path') };
        logger.logProcess('test', ['--foo', '--bar'], options);

        sinon.assert.calledWithExactly(traceLogStub, `> test --foo --bar`);
        sinon.assert.calledWithExactly(
            traceLogStub,
            `${Logging.currentWorkingDirectory} ${path.join('~', 'debug', 'path')}`,
        );
    });

    test('Logger replaces the path/to/home with ~ in the command path where the home path IS at the beginning of the path', async () => {
        const options = { cwd: path.join('debug', 'path') };
        logger.logProcess(path.join(untildify('~'), 'test'), ['--foo', '--bar'], options);

        sinon.assert.calledWithExactly(traceLogStub, `> ${path.join('~', 'test')} --foo --bar`);
        sinon.assert.calledWithExactly(traceLogStub, `${Logging.currentWorkingDirectory} ${options.cwd}`);
    });

    test('Logger replaces the path/to/home with ~ in the command path where the home path IS at the beginning of the path but another arg contains other ref to home folder', async () => {
        const options = { cwd: path.join('debug', 'path') };
        logger.logProcess(path.join(untildify('~'), 'test'), ['--foo', path.join(untildify('~'), 'boo')], options);

        sinon.assert.calledWithExactly(traceLogStub, `> ${path.join('~', 'test')} --foo ${path.join('~', 'boo')}`);
        sinon.assert.calledWithExactly(traceLogStub, `${Logging.currentWorkingDirectory} ${options.cwd}`);
    });

    test('Logger replaces the path/to/home with ~ in the command path where the home path IS at the beginning of the path between doble quotes', async () => {
        const options = { cwd: path.join('debug', 'path') };
        logger.logProcess(`"${path.join(untildify('~'), 'test')}" "--foo" "--bar"`, undefined, options);

        sinon.assert.calledWithExactly(traceLogStub, `> "${path.join('~', 'test')}" "--foo" "--bar"`);
        sinon.assert.calledWithExactly(traceLogStub, `${Logging.currentWorkingDirectory} ${options.cwd}`);
    });

    test('Logger replaces the path/to/home with ~ in the command path where the home path IS NOT at the beginning of the path', async () => {
        const options = { cwd: path.join('debug', 'path') };
        logger.logProcess(path.join('net', untildify('~'), 'test'), ['--foo', '--bar'], options);

        sinon.assert.calledWithExactly(traceLogStub, `> ${path.join('net', '~', 'test')} --foo --bar`);
        sinon.assert.calledWithExactly(traceLogStub, `${Logging.currentWorkingDirectory} ${options.cwd}`);
    });

    test('Logger replaces the path/to/home with ~ in the command path where the home path IS NOT at the beginning of the path but another arg contains other ref to home folder', async () => {
        const options = { cwd: path.join('debug', 'path') };
        logger.logProcess(
            path.join('net', untildify('~'), 'test'),
            ['--foo', path.join(untildify('~'), 'boo')],
            options,
        );

        sinon.assert.calledWithExactly(
            traceLogStub,
            `> ${path.join('net', '~', 'test')} --foo ${path.join('~', 'boo')}`,
        );
        sinon.assert.calledWithExactly(traceLogStub, `${Logging.currentWorkingDirectory} ${options.cwd}`);
    });

    test('Logger replaces the path/to/home with ~ in the command path where the home path IS NOT at the beginning of the path between doble quotes', async () => {
        const options = { cwd: path.join('debug', 'path') };
        logger.logProcess(`"${path.join('net', untildify('~'), 'test')}" "--foo" "--bar"`, undefined, options);

        sinon.assert.calledWithExactly(traceLogStub, `> "${path.join('net', '~', 'test')}" "--foo" "--bar"`);
        sinon.assert.calledWithExactly(traceLogStub, `${Logging.currentWorkingDirectory} ${options.cwd}`);
    });

    test('Logger replaces the path/to/home with ~ if shell command is provided', async () => {
        const options = { cwd: path.join('debug', 'path') };
        logger.logProcess(`"${path.join(untildify('~'), 'test')}" "--foo" "--bar"`, undefined, options);

        sinon.assert.calledWithExactly(traceLogStub, `> "${path.join('~', 'test')}" "--foo" "--bar"`);
        sinon.assert.calledWithExactly(traceLogStub, `${Logging.currentWorkingDirectory} ${options.cwd}`);
    });

    test('Logger replaces the path to workspace with . if exactly one workspace folder is opened', async () => {
        const options = { cwd: path.join('path', 'to', 'workspace', 'debug', 'path') };
        logger.logProcess(`"${path.join('path', 'to', 'workspace', 'test')}" "--foo" "--bar"`, undefined, options);

        sinon.assert.calledWithExactly(traceLogStub, `> ".${path.sep}test" "--foo" "--bar"`);
        sinon.assert.calledWithExactly(
            traceLogStub,
            `${Logging.currentWorkingDirectory} .${path.sep + path.join('debug', 'path')}`,
        );
    });

    test('On Windows, logger replaces both backwards and forward slash version of path to workspace with . if exactly one workspace folder is opened', async function () {
        if (getOSType() !== OSType.Windows) {
            return this.skip();
        }
        let options = { cwd: path.join('path/to/workspace', 'debug', 'path') };

        logger.logProcess(`"${path.join('path', 'to', 'workspace', 'test')}" "--foo" "--bar"`, undefined, options);

        sinon.assert.calledWithExactly(traceLogStub, `> ".${path.sep}test" "--foo" "--bar"`);
        sinon.assert.calledWithExactly(
            traceLogStub,
            `${Logging.currentWorkingDirectory} .${path.sep + path.join('debug', 'path')}`,
        );
        traceLogStub.resetHistory();

        options = { cwd: path.join('path\\to\\workspace', 'debug', 'path') };
        logger.logProcess(`"${path.join('path', 'to', 'workspace', 'test')}" "--foo" "--bar"`, undefined, options);

        sinon.assert.calledWithExactly(traceLogStub, `> ".${path.sep}test" "--foo" "--bar"`);
        sinon.assert.calledWithExactly(
            traceLogStub,
            `${Logging.currentWorkingDirectory} .${path.sep + path.join('debug', 'path')}`,
        );
    });

    test("Logger doesn't display the working directory line if there is no options parameter", async () => {
        logger.logProcess(path.join(untildify('~'), 'test'), ['--foo', '--bar']);

        sinon.assert.calledWithExactly(traceLogStub, `> ${path.join('~', 'test')} --foo --bar`);
    });

    test("Logger doesn't display the working directory line if there is no cwd key in the options parameter", async () => {
        const options = {};
        logger.logProcess(path.join(untildify('~'), 'test'), ['--foo', '--bar'], options);

        sinon.assert.calledWithExactly(traceLogStub, `> ${path.join('~', 'test')} --foo --bar`);
    });
});

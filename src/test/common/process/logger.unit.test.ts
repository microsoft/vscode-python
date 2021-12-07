// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';

import untildify = require('untildify');
import { WorkspaceFolder } from 'vscode';
import { IWorkspaceService } from '../../../client/common/application/types';
import { ProcessLogger } from '../../../client/common/process/logger';
import { IOutputChannel } from '../../../client/common/types';
import { Logging } from '../../../client/common/utils/localize';
import { getOSType, OSType } from '../../../client/common/utils/platform';

suite('ProcessLogger suite', () => {
    let outputChannel: TypeMoq.IMock<IOutputChannel>;
    let workspaceService: TypeMoq.IMock<IWorkspaceService>;
    let outputResult: string;
    let logger: ProcessLogger;

    suiteSetup(() => {
        outputChannel = TypeMoq.Mock.ofType<IOutputChannel>();
        workspaceService = TypeMoq.Mock.ofType<IWorkspaceService>();
        workspaceService
            .setup((w) => w.workspaceFolders)
            .returns(() => [({ uri: { fsPath: path.join('path', 'to', 'workspace') } } as unknown) as WorkspaceFolder]);
        logger = new ProcessLogger(outputChannel.object, workspaceService.object);
    });

    setup(() => {
        outputResult = '';
        outputChannel
            .setup((o) => o.appendLine(TypeMoq.It.isAnyString()))
            .returns((s: string) => (outputResult += `${s}\n`));
    });

    teardown(() => {
        outputChannel.reset();
    });

    test('Logger displays the process command, arguments and current working directory in the output channel', async () => {
        const options = { cwd: path.join('debug', 'path') };
        logger.logProcess('test', ['--foo', '--bar'], options);

        const expectedResult = `> test --foo --bar\n${Logging.currentWorkingDirectory()} ${options.cwd}\n`;
        expect(outputResult).to.equal(expectedResult, 'Output string is incorrect - String built incorrectly');

        outputChannel.verify((o) => o.appendLine(TypeMoq.It.isAnyString()), TypeMoq.Times.exactly(2));
    });

    test('Logger adds quotes around arguments if they contain spaces', async () => {
        const options = { cwd: path.join('debug', 'path') };
        logger.logProcess('test', ['--foo', '--bar', 'import test'], options);

        const expectedResult = `> test --foo --bar "import test"\n${Logging.currentWorkingDirectory()} ${path.join(
            'debug',
            'path',
        )}\n`;
        expect(outputResult).to.equal(expectedResult, 'Output string is incorrect: Home directory is not tildified');
    });

    test('Logger preserves quotes around arguments if they contain spaces', async () => {
        const options = { cwd: path.join('debug', 'path') };
        logger.logProcess('test', ['--foo', '--bar', '"import test"'], options);

        const expectedResult = `> test --foo --bar \"import test\"\n${Logging.currentWorkingDirectory()} ${path.join(
            'debug',
            'path',
        )}\n`;
        expect(outputResult).to.equal(expectedResult, 'Output string is incorrect: Home directory is not tildified');
    });

    test('Logger converts single quotes around arguments to double quotes if they contain spaces', async () => {
        const options = { cwd: path.join('debug', 'path') };
        logger.logProcess('test', ['--foo', '--bar', "'import test'"], options);

        const expectedResult = `> test --foo --bar \"import test\"\n${Logging.currentWorkingDirectory()} ${path.join(
            'debug',
            'path',
        )}\n`;
        expect(outputResult).to.equal(expectedResult, 'Output string is incorrect: Home directory is not tildified');
    });

    test('Logger removes single quotes around arguments if they do not contain spaces', async () => {
        const options = { cwd: path.join('debug', 'path') };
        logger.logProcess('test', ['--foo', '--bar', "'importtest'"], options);

        const expectedResult = `> test --foo --bar importtest\n${Logging.currentWorkingDirectory()} ${path.join(
            'debug',
            'path',
        )}\n`;
        expect(outputResult).to.equal(expectedResult, 'Output string is incorrect: Home directory is not tildified');
    });

    test('Logger replaces the path/to/home with ~ in the current working directory', async () => {
        const options = { cwd: path.join(untildify('~'), 'debug', 'path') };
        logger.logProcess('test', ['--foo', '--bar'], options);

        const expectedResult = `> test --foo --bar\n${Logging.currentWorkingDirectory()} ${path.join(
            '~',
            'debug',
            'path',
        )}\n`;
        expect(outputResult).to.equal(expectedResult, 'Output string is incorrect: Home directory is not tildified');
    });

    test('Logger replaces the path/to/home with ~ in the command path', async () => {
        const options = { cwd: path.join('debug', 'path') };
        logger.logProcess(path.join(untildify('~'), 'test'), ['--foo', '--bar'], options);

        const expectedResult = `> ${path.join('~', 'test')} --foo --bar\n${Logging.currentWorkingDirectory()} ${
            options.cwd
        }\n`;
        expect(outputResult).to.equal(expectedResult, 'Output string is incorrect: Home directory is not tildified');
    });

    test('Logger replaces the path/to/home with ~ if shell command is provided', async () => {
        const options = { cwd: path.join('debug', 'path') };
        logger.logProcess(`"${path.join(untildify('~'), 'test')}" "--foo" "--bar"`, undefined, options);

        const expectedResult = `> "${path.join('~', 'test')}" "--foo" "--bar"\n${Logging.currentWorkingDirectory()} ${
            options.cwd
        }\n`;
        expect(outputResult).to.equal(expectedResult, 'Output string is incorrect: Home directory is not tildified');
    });

    test('Logger replaces the path to workspace with . if exactly one workspace folder is opened', async () => {
        const options = { cwd: path.join('path', 'to', 'workspace', 'debug', 'path') };
        logger.logProcess(`"${path.join('path', 'to', 'workspace', 'test')}" "--foo" "--bar"`, undefined, options);

        const expectedResult = `> ".${path.sep}test" "--foo" "--bar"\n${Logging.currentWorkingDirectory()} .${
            path.sep + path.join('debug', 'path')
        }\n`;
        expect(outputResult).to.equal(expectedResult, 'Output string is incorrect');
    });

    test('On Windows, logger replaces both backwards and forward slash version of path to workspace with . if exactly one workspace folder is opened', async function () {
        if (getOSType() !== OSType.Windows) {
            return this.skip();
        }
        let options = { cwd: path.join('path/to/workspace', 'debug', 'path') };

        const expectedResult = `> ".${path.sep}test" "--foo" "--bar"\n${Logging.currentWorkingDirectory()} .${
            path.sep + path.join('debug', 'path')
        }\n`;

        logger.logProcess(`"${path.join('path', 'to', 'workspace', 'test')}" "--foo" "--bar"`, undefined, options);
        expect(outputResult).to.equal(expectedResult, 'Output string is incorrect for case 1');

        outputResult = '';

        options = { cwd: path.join('path\\to\\workspace', 'debug', 'path') };
        logger.logProcess(`"${path.join('path', 'to', 'workspace', 'test')}" "--foo" "--bar"`, undefined, options);

        expect(outputResult).to.equal(expectedResult, 'Output string is incorrect for case 2');
    });

    test("Logger doesn't display the working directory line if there is no options parameter", async () => {
        logger.logProcess(path.join(untildify('~'), 'test'), ['--foo', '--bar']);

        const expectedResult = `> ${path.join('~', 'test')} --foo --bar\n`;
        expect(outputResult).to.equal(
            expectedResult,
            'Output string is incorrect: Working directory line should not be displayed',
        );
    });

    test("Logger doesn't display the working directory line if there is no cwd key in the options parameter", async () => {
        const options = {};
        logger.logProcess(path.join(untildify('~'), 'test'), ['--foo', '--bar'], options);

        const expectedResult = `> ${path.join('~', 'test')} --foo --bar\n`;
        expect(outputResult).to.equal(
            expectedResult,
            'Output string is incorrect: Working directory line should not be displayed',
        );
    });
});

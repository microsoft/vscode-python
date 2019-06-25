// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import * as TypeMoq from 'typemoq';
// tslint:disable-next-line:no-require-imports
import untildify = require('untildify');

import { STANDARD_OUTPUT_CHANNEL } from '../../../client/common/constants';
import { PathUtils } from '../../../client/common/platform/pathUtils';
import { ProcessLogger } from '../../../client/common/process/logger';
import { IOutputChannel } from '../../../client/common/types';
import { Logging } from '../../../client/common/utils/localize';
import { IServiceContainer } from '../../../client/ioc/types';
import { getOSType, OSType } from '../../common';

suite('ProcessLogger suite', () => {
    let outputChannel: TypeMoq.IMock<IOutputChannel>;
    let serviceContainer: TypeMoq.IMock<IServiceContainer>;
    let pathUtils: PathUtils;
    let outputResult: string;

    suiteSetup(() => {
        outputChannel = TypeMoq.Mock.ofType<IOutputChannel>();
        serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        pathUtils = new PathUtils(getOSType() === OSType.Windows);
    });

    setup(() => {
        outputChannel.setup(o => o.appendLine(TypeMoq.It.isAnyString())).returns((s: string) => outputResult = s);
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IOutputChannel), STANDARD_OUTPUT_CHANNEL)).returns(() => outputChannel.object);
    });

    teardown(() => {
        outputChannel.reset();
        serviceContainer.reset();
    });

    test('Logger displays the process command, arguments and current working directory in the output channel', async () => {
        const options = { cwd: path.join('debug', 'path')};
        const logger = new ProcessLogger(serviceContainer.object, pathUtils);
        logger.logProcess({ file: 'test', args: ['--foo', '--bar'], options });

        const expectedResult = `> test --foo --bar\n${Logging.currentWorkingDirectory()} ${options.cwd}`;
        expect(outputResult).to.equal(expectedResult, 'Output string is incorrect - String built incorrectly');

        outputChannel.verify(o => o.appendLine(TypeMoq.It.isAnyString()), TypeMoq.Times.once());
    });

    test('Logger replaces the path/to/home with ~', async () => {
        const options = { cwd: path.join(untildify('~'), 'debug', 'path') };
        const logger = new ProcessLogger(serviceContainer.object, pathUtils);
        logger.logProcess({ file: 'test', args: ['--foo', '--bar'], options});

        const expectedResult = `> test --foo --bar\n${Logging.currentWorkingDirectory()} ${path.join('~', 'debug', 'path')}`;
        expect(outputResult).to.equal(expectedResult, 'Output string is incorrect: Home directory is not tildified');
    });
});

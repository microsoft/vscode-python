// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable: no-var-requires no-require-imports
import * as path from 'path';
import { extensionRootPath } from '../constants';
import { getOSType } from './misc';
const reporter = require('cucumber-html-reporter');

const options = {
    theme: 'hierarchy',
    jsonFile: path.join(extensionRootPath, 'cucumber-report.json'),
    output: path.join(extensionRootPath, '.vscode test/reports/report.html'),
    reportSuiteAsScenarios: true,
    launchReport: false,
    brandTitle: 'Python VS Code (UI Tests)',
    metadata: {
        'Operating System': getOSType()
    }
};

reporter.generate(options);

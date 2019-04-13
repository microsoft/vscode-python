// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

const reporter = require('cucumber-html-reporter');
const path = require('path');
const os = require('os');
const reportsDir = process.argv[2];
const launchReport = process.argv[3].toUpperCase() === 'TRUE';

const options = {
    theme: 'bootstrap',
    jsonFile: path.join(reportsDir, 'report.json'),
    output: path.join(reportsDir, 'report.html'),
    reportSuiteAsScenarios: true,
    launchReport,
    metadata: {
        "Platform": os.platform()
    }
};

reporter.generate(options, () => process.exit(0));

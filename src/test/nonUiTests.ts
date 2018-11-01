// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any no-require-imports no-var-requires

if ((Reflect as any).metadata === undefined) {
    require('reflect-metadata');
}

// Custom module loader so we skip .css files that break non webpack wrapped compiles
// tslint:disable-next-line:no-var-requires no-require-imports
const Module = require('module');

// tslint:disable-next-line:no-function-expression
(function () {
    const origRequire = Module.prototype.require;
    const _require = (context, filepath) => {
        return origRequire.call(context, filepath);
    };

    Module.prototype.require = function (filepath) {
        if (filepath.endsWith('.css')) {
            return '';
        }
        // tslint:disable-next-line:no-invalid-this
        return _require(this, filepath);
    };
})();

import * as glob from 'glob';
import * as Mocha from 'mocha';
import * as path from 'path';
import { MochaSetupOptions } from 'vscode/lib/testrunner';
import { MOCHA_CI_REPORTER_ID, MOCHA_CI_REPORTFILE,
    MOCHA_REPORTER_JUNIT } from './ciConstants';
import { setUpDomEnvironment } from './datascience/reactHelpers';
import * as vscodeMoscks from './vscode-mock';

process.env.VSC_PYTHON_CI_TEST = '1';

export function runTests(testOptions?: { filePattern: string; grep?: string; timeout?: number }) {
    // nteract/transforms-full expects to run in the browser so we have to fake
    // parts of the browser here.
    setUpDomEnvironment();

    vscodeMoscks.initialize();

    const grep: string | undefined = testOptions ? testOptions.grep : undefined;
    const timeout: number | undefined = testOptions ? testOptions.timeout : undefined;
    const filePattern : string = testOptions ? testOptions.filePattern : '**/**.unit.test.js';

    const options: MochaSetupOptions = {
        ui: 'tdd',
        useColors: true,
        timeout,
        grep
    };

    let temp_mocha: Mocha | undefined;

    if (MOCHA_REPORTER_JUNIT === true) {
        temp_mocha = new Mocha({
            grep: undefined,
            ui: 'tdd',
            timeout,
            reporter: MOCHA_CI_REPORTER_ID,
            reporterOptions: {
                useColors: false,
                mochaFile: MOCHA_CI_REPORTFILE,
                bail: false
            },
            slow: undefined
        });
    } else {
        // we are running on the command line or debugger...
        temp_mocha = new Mocha(options);
    }

    const mocha: Mocha = temp_mocha;

    require('source-map-support').install();
    const testsRoot = __dirname;
    glob(filePattern, { cwd: testsRoot }, (error, files) => {
        if (error) {
            return reportErrors(error);
        }
        try {
            files.forEach(file => mocha.addFile(path.join(testsRoot, file)));
            mocha.run(failures => {
                if (failures === 0) {
                    return;
                }
                reportErrors(undefined, failures);
            });
        } catch (error) {
            reportErrors(error);
        }
    });
}
function reportErrors(error?: Error, failures?: number) {
    let failed = false;
    if (error) {
        console.error(error);
        failed = true;
    }
    if (failures && failures >= 0) {
        console.error(`${failures} failed tests 👎.`);
        failed = true;
    }
    if (failed) {
        process.exit(1);
    }
}
export function extractParams() : { grep: string; timeout: number } {
    // When running from debugger, allow custom args.
    const args = process.argv0.length > 2 ? process.argv.slice(2) : [];
    const timeoutArgIndex = args.findIndex(arg => arg.startsWith('timeout='));
    const grepArgIndex = args.findIndex(arg => arg.startsWith('grep='));
    const timeout: number | undefined = timeoutArgIndex >= 0 ? parseInt(args[timeoutArgIndex].split('=')[1].trim(), 10) : undefined;
    let grep: string | undefined = grepArgIndex >= 0 ? args[grepArgIndex].split('=')[1].trim() : undefined;
    grep = grep && grep.length > 0 ? grep : undefined;
    return { grep: grep, timeout: timeout };
}

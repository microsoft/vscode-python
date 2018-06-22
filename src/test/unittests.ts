// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-any no-require-imports no-var-requires

if ((Reflect as any).metadata === undefined) {
    require('reflect-metadata');
}
import * as glob from 'glob';
import * as Mocha from 'mocha';
import * as path from 'path';
import { MochaSetupOptions } from 'vscode/lib/testrunner';
import { MOCHA_CI_REPORTFILE, MOCHA_REPORTER_JUNIT } from './ciConstants';
import * as vscodeMoscks from './vscode-mock';

export function runTests(testOptions?: { grep?: string; timeout?: number }) {
    vscodeMoscks.initialize();

    const grep: string | undefined = testOptions ? testOptions.grep : undefined;
    const timeout: number | undefined = testOptions ? testOptions.timeout : undefined;

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
            reporter: '../../../.mocha-reporter/mocha-vsts-reporter.js',
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
    glob('**/**.unit.test.js', { cwd: testsRoot }, (error, files) => {
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
// this allows us to run hygiene as a git pre-commit hook or via debugger.
if (require.main === module) {
    // When running from debugger, allow custom args.
    const args = process.argv0.length > 2 ? process.argv.slice(2) : [];
    const timeoutArgIndex = args.findIndex(arg => arg.startsWith('timeout='));
    const grepArgIndex = args.findIndex(arg => arg.startsWith('grep='));
    const timeout: number | undefined = timeoutArgIndex >= 0 ? parseInt(args[timeoutArgIndex].split('=')[1].trim(), 10) : undefined;
    let grep: string | undefined = timeoutArgIndex >= 0 ? args[grepArgIndex].split('=')[1].trim() : undefined;
    grep = grep && grep.length > 0 ? grep : undefined;

    runTests({ grep, timeout });
}

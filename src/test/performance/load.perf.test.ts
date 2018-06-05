// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-invalid-this no-console

import { expect } from 'chai';
import * as fs from 'fs-extra';
import { EOL } from 'os';
import * as path from 'path';
import { commands, extensions } from 'vscode';
import { StopWatch } from '../../client/common/stopWatch';

const AllowedIncreaseInActivationDelayInMS = 500;

suite('Activation Times', () => {
    if (process.env.ACTIVATION_TIMES_LOG_FILE_PATH) {
        const logFile = process.env.ACTIVATION_TIMES_LOG_FILE_PATH;
        const sampleCounter = fs.existsSync(logFile) ? fs.readFileSync(logFile, { encoding: 'utf8' }).toString().split(/\r?\n/g).length : 1;
        if (sampleCounter > 10) {
            return;
        }
        test(`Capture Extension Activation Times (Version: ${process.env.ACTIVATION_TIMES_EXT_VERSION}, sample: ${sampleCounter})`, async () => {
            const pythonExtension = extensions.getExtension('ms-python.python');
            if (pythonExtension) {
                throw new Error('Python Extension not found');
            }
            const stopWatch = new StopWatch();
            await pythonExtension!.activate();
            const elapsedTime = stopWatch.elapsedTime;
            if (elapsedTime > 10) {
                await fs.ensureDir(path.dirname(logFile));
                await fs.appendFile(logFile, `${elapsedTime}${EOL}`, { encoding: 'utf8' });
                console.log(`Loaded in ${elapsedTime}ms`);
            }
            commands.executeCommand('workbench.action.reloadWindow');
        });
    }

    if (process.env.ACTIVATION_TIMES_DEV_LOG_FILE_PATHS &&
        process.env.ACTIVATION_TIMES_RELEASE_LOG_FILE_PATHS &&
        process.env.ACTIVATION_TIMES_DEV_ANALYSIS_LOG_FILE_PATHS) {

        test('Test activation times of Dev vs Release Extension', async () => {
            function getActivationTimes(files: string[]) {
                const activationTimes: number[] = [];
                for (const file of files) {
                    fs.readFileSync(file, { encoding: 'utf8' }).toString()
                        .split(/\r?\n/g)
                        .map(line => line.trim())
                        .filter(line => line.length > 0)
                        .map(line => parseInt(line, 10))
                        .forEach(item => activationTimes.push(item));
                }
                return activationTimes;
            }
            const devActivationTimes = getActivationTimes(JSON.parse(process.env.ACTIVATION_TIMES_DEV_LOG_FILE_PATHS!));
            const releaseActivationTimes = getActivationTimes(JSON.parse(process.env.ACTIVATION_TIMES_RELEASE_LOG_FILE_PATHS!));
            const analysisEngineActivationTimes = getActivationTimes(JSON.parse(process.env.ACTIVATION_TIMES_DEV_ANALYSIS_LOG_FILE_PATHS!));
            const devActivationAvgTime = devActivationTimes.reduce((sum, item) => sum + item, 0) / devActivationTimes.length;
            const releaseActivationAvgTime = releaseActivationTimes.reduce((sum, item) => sum + item, 0) / releaseActivationTimes.length;
            const analysisEngineActivationAvgTime = analysisEngineActivationTimes.reduce((sum, item) => sum + item, 0) / analysisEngineActivationTimes.length;

            console.log(`Dev version Loaded in ${devActivationAvgTime}ms`);
            console.log(`Release version Loaded in ${releaseActivationAvgTime}ms`);
            console.log(`Analysis Engine Loaded in ${analysisEngineActivationAvgTime}ms`);

            expect(devActivationAvgTime - releaseActivationAvgTime).to.be.lessThan(AllowedIncreaseInActivationDelayInMS, 'Activation times have increased above allowed threshold.');
        });
    }
});

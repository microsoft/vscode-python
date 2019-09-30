// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { RetryOptions } from './helpers';

export const isCI = process.env.TRAVIS === 'true' || process.env.TF_BUILD !== undefined;
export const uitestsRootPath = path.join(__dirname, '..');
export const featurePath = path.join(uitestsRootPath, 'features');
export const vscodeTestPath = path.join(uitestsRootPath, '.vscode test');

// Assume 1 minute is enough for extension to get activated.
// Remember, activation of extension is slow on Windows.
export const extensionActivationTimeout = 60_000;
export const maxStepTimeout = 150_000;
export const maxHookTimeout = 240_000;

// Tooltip of the Statusbar created the Bootstrap extension to indicate it has activated.
export const pyBootstrapTooltip = 'Py';
// Tooltip of the Statusbar created by the Bootstrap extension when Python Extension has activated.
export const pyBootstrapActivatedStatusBarTooltip = 'Py2';

export const RetryMax30Seconds: RetryOptions = { timeout: 30_000, interval: 100 };
export const RetryMax20Seconds: RetryOptions = { timeout: 20_000, interval: 100 };
export const RetryMax10Seconds: RetryOptions = { timeout: 10_000, interval: 100 };
export const RetryMax5Seconds: RetryOptions = { timeout: 5_000, interval: 100 };
export const RetryMax2Seconds: RetryOptions = { timeout: 2_000, interval: 100 };
export const RetryMax5Times: RetryOptions = { count: 5, interval: 100 };
export const RetryMax2Times: RetryOptions = { count: 2, interval: 100 };

export const CucumberRetryMax30Seconds: {} = { wrapperOptions: { retry: RetryMax30Seconds } };
export const CucumberRetryMax20Seconds: {} = { wrapperOptions: { retry: RetryMax20Seconds } };
export const CucumberRetryMax10Seconds: {} = { wrapperOptions: { retry: RetryMax10Seconds } };
export const CucumberRetryMax5Seconds: {} = { wrapperOptions: { retry: RetryMax5Seconds } };
export const CucumberRetryMax2Seconds: {} = { wrapperOptions: { retry: RetryMax2Seconds } };
export const CucumberRetryMax5Times: {} = { wrapperOptions: { retry: RetryMax5Times } };
export const CucumberRetryMax2Times: {} = { wrapperOptions: { retry: RetryMax2Times } };

export type localizationKeys = 'debug.selectConfigurationTitle';

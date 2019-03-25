// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as util from './util';

export const ExtensionRootDir = util.ExtensionRootDir;

// This is a list of files that existed before MS got the extension.
export const existingFiles: string[] = util.getListOfFiles('existingFiles.json');
export const contributedFiles: string[] = util.getListOfFiles('contributedFiles.json');

export const isCI = process.env.TRAVIS === 'true' || process.env.TF_BUILD !== undefined;

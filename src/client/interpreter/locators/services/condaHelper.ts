// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import '../../../common/extensions';
import { CondaInfo } from '../../contracts';
import { AnacondaDisplayName, AnacondaIdentifiers } from './conda';

export type EnvironmentPath = string;
export type EnvironmentName = string;

/**
 * Helpers for conda.
 */
export class CondaHelper {
    /**
     * Return the string to display for the conda interpreter.
     */
    public getDisplayName(condaInfo: CondaInfo = {}): string {
        // Samples.
        // "3.6.1 |Anaconda 4.4.0 (64-bit)| (default, May 11 2017, 13:25:24) [MSC v.1900 64 bit (AMD64)]".
        // "3.6.2 |Anaconda, Inc.| (default, Sep 21 2017, 18:29:43) \n[GCC 4.2.1 Compatible Clang 4.0.1 (tags/RELEASE_401/final)]".
        const sysVersion = condaInfo['sys.version'];
        if (!sysVersion) {
            return AnacondaDisplayName;
        }

        // Take the second part of the sys.version.
        const sysVersionParts = sysVersion.split('|', 2);
        if (sysVersionParts.length === 2) {
            const displayName = sysVersionParts[1].trim();
            if (this.isIdentifiableAsAnaconda(displayName)) {
                return displayName;
            } else {
                return `${displayName} : ${AnacondaDisplayName}`;
            }
        } else {
            return AnacondaDisplayName;
        }
    }

    /**
     * Parses output returned by the command `conda env list`.
     * Sample output is as follows:
     * # conda environments:
     * #
     * base                  *  /Users/donjayamanne/anaconda3
     * one                      /Users/donjayamanne/anaconda3/envs/one
     * one two                  /Users/donjayamanne/anaconda3/envs/one two
     * py27                     /Users/donjayamanne/anaconda3/envs/py27
     * py36                     /Users/donjayamanne/anaconda3/envs/py36
     * three                    /Users/donjayamanne/anaconda3/envs/three
     *                          /Users/donjayamanne/anaconda3/envs/four
     *                          /Users/donjayamanne/anaconda3/envs/five 5
     * @param {string} condaEnvironmentList
     * @param {CondaInfo} condaInfo
     * @returns {{ name: string, path: string }[] | undefined}
     * @memberof CondaHelper
     */
    public parseCondaEnvironmentNames(condaEnvironmentList: string): { name: string; path: string }[] | undefined {
        const environments = condaEnvironmentList.splitLines({ trim: false });
        const baseEnvironmentLine = environments.filter((line) => line.indexOf('*') > 0);
        if (baseEnvironmentLine.length === 0) {
            return;
        }
        const pathStartIndex = baseEnvironmentLine[0].indexOf(baseEnvironmentLine[0].split('*')[1].trim());
        const envs: { name: string; path: string }[] = [];
        environments.forEach((line) => {
            if (line.length <= pathStartIndex) {
                return;
            }
            let name = line.substring(0, pathStartIndex).trim();
            if (name.endsWith('*')) {
                name = name.substring(0, name.length - 1).trim();
            }
            const envPath = line.substring(pathStartIndex).trim();
            if (envPath.length > 0) {
                envs.push({ name, path: envPath });
            }
        });

        return envs;
    }

    /**
     * Does the given string match a known Anaconda identifier.
     */
    private isIdentifiableAsAnaconda(value: string) {
        const valueToSearch = value.toLowerCase();
        return AnacondaIdentifiers.some((item) => valueToSearch.indexOf(item.toLowerCase()) !== -1);
    }
}

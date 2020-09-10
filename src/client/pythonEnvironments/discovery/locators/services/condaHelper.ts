// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import '../../../../common/extensions';
import { AnacondaDisplayName, AnacondaIdentifiers, CondaInfo } from './conda';

export type EnvironmentPath = string;
export type EnvironmentName = string;

/**
 * Helpers for conda.
 */

/**
 * Return the string to display for the conda interpreter.
 */
export function getDisplayName(condaInfo: CondaInfo = {}): string {
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
        if (isIdentifiableAsAnaconda(displayName)) {
            return displayName;
        }
        return `${displayName} : ${AnacondaDisplayName}`;
    }
    return AnacondaDisplayName;
}

/**
 * Parses output returned by the command `conda env list`.
 * Sample output is as follows:
 * # conda environments:
 * #
 * base                  *  /Users/donjayamanne/anaconda3
 * one                      /Users/donjayamanne/anaconda3/envs/one
 * py27                     /Users/donjayamanne/anaconda3/envs/py27
 * py36                     /Users/donjayamanne/anaconda3/envs/py36
 * three                    /Users/donjayamanne/anaconda3/envs/three
 *                          /Users/donjayamanne/anaconda3/envs/four
 *                          /Users/donjayamanne/anaconda3/envs/five 5
 * aaaa_bbbb_cccc_dddd_eeee_ffff_gggg     /Users/donjayamanne/anaconda3/envs/aaaa_bbbb_cccc_dddd_eeee_ffff_gggg
 * with*star                /Users/donjayamanne/anaconda3/envs/with*star
 *                          "/Users/donjayamanne/anaconda3/envs/seven "
 */
export function parseCondaEnvFileContents(
    condaEnvFileContents: string,
): { name: string; path: string; isActive: boolean }[] | undefined {
    // Don't trim the lines. `path` portion of the line can end with a space.
    const lines = condaEnvFileContents.splitLines({ trim: false });
    const envs: { name: string; path: string; isActive: boolean }[] = [];

    lines.forEach((line) => {
        const item = parseCondaEnvFileLine(line);
        if (item) {
            envs.push(item);
        }
    });

    return envs.length > 0 ? envs : undefined;
}

function parseCondaEnvFileLine(line: string): { name: string; path: string; isActive: boolean } | undefined {
    // Empty lines or lines starting with `#` are comments and can be ignored.
    if (line.length === 0 || line.startsWith('#')) {
        return undefined;
    }

    // This extraction is based on the following code for `conda env list`:
    // https://github.com/conda/conda/blob/f207a2114c388fd17644ee3a5f980aa7cf86b04b/conda/cli/common.py#L188
    // It uses "%-20s  %s  %s" as the format string. Where the middle %s is '*'
    // if the environment is active, and ' '  if it is not active.

    // If conda environment was created using `-p` then it may NOT have a name.
    // Use empty string as default name for envs created using path only.
    let name = '';
    let remainder = line;

    // The `name` and `path` parts are separated by at least 5 spaces. We cannot
    // use a single space here since it can be part of the name (see below for
    // name spec). Another assumption here is that `name` does not start with
    // 5*spaces or somewhere in the center. However, `     name` or `a     b` is
    // a valid name when using --clone. Highly unlikely that users will have this
    // form as the environment name. lastIndexOf() can also be used but that assumes
    // that `path` does NOT end with 5*spaces.
    let spaceIndex = line.indexOf('     ');
    if (spaceIndex === -1) {
        // This means the environment name is longer than 17 characters and it is
        // active. Try '  *  ' for separator between name and path.
        spaceIndex = line.indexOf('  *  ');
    }

    if (spaceIndex > 0) {
        // Parsing `name`
        // > `conda create -n <name>`
        // conda environment `name` should NOT have following characters
        // ('/', ' ', ':', '#'). So we can use the index of 5*space
        // characters to extract the name.
        //
        // > `conda create --clone one -p "~/envs/one two"`
        // this can generate a cloned env with name `one two`. This is
        // only allowed for cloned environments. In both cases, the best
        // separator is 5*spaces. It is highly unlikely that users will have
        // 5*spaces in their environment name.
        //
        // Notes: When using clone if the path has a trailing space, it will
        // not be preserved for the name. Trailing spaces in environment names
        // are NOT allowed. But leading spaces are allowed. Currently there no
        // special separator character between name and path, other than spaces.
        // We will need a well known separator if this ever becomes a issue.
        name = line.substring(0, spaceIndex).trimRight();
        remainder = line.substring(spaceIndex);
    }

    // Detecting Active Environment:
    // Only active environment will have `*` between `name` and `path`. `name`
    // or `path` can have `*` in them as well. So we have to look for `*` in
    // between `name` and `path`. We already extracted the name, the next non-
    // whitespace character should either be `*` or environment path.
    remainder = remainder.trimLeft();
    const isActive = remainder.startsWith('*');

    // Parsing `path`
    // If `*` is the first then we can skip that character. Trim left again,
    // don't do trim() or trimRight(), since paths can end with a space.
    remainder = (isActive ? remainder.substring(1) : remainder).trimLeft();

    return { name, path: remainder, isActive };
}
/**
 * Does the given string match a known Anaconda identifier.
 */
function isIdentifiableAsAnaconda(value: string) {
    const valueToSearch = value.toLowerCase();
    return AnacondaIdentifiers.some((item) => valueToSearch.indexOf(item.toLowerCase()) !== -1);
}

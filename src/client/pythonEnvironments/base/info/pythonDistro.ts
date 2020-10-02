// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { cloneDeep } from 'lodash';
import { mergeVersions } from '../../../common/utils/version';

import { PythonDistroInfo, PythonDistroMetaInfo } from '.';

/**
 * Make a copy of "distro" and fill in empty properties using "other."
 */
export function mergeDistros(distro: PythonDistroInfo, other: PythonDistroInfo): PythonDistroInfo {
    const merged: PythonDistroInfo = mergeMetaDistros(distro, other);

    if (other.version !== undefined) {
        if (distro.version === undefined) {
            merged.version = cloneDeep(other.version);
        } else {
            merged.version = mergeVersions(distro.version, other.version);
        }
    } else if (distro.version !== undefined) {
        merged.version = cloneDeep(distro.version);
    }

    if (distro.binDir !== undefined && distro.binDir !== '') {
        merged.binDir = distro.binDir;
    } else if (other.binDir !== undefined) {
        merged.binDir = other.binDir;
    }

    return merged;
}

function mergeMetaDistros(
    meta: PythonDistroMetaInfo,
    other: PythonDistroMetaInfo,
): PythonDistroMetaInfo {
    const merged: PythonDistroMetaInfo = {
        org: meta.org,
    };

    if (meta.org === '') {
        merged.org = other.org;
    }

    if (meta.defaultDisplayName !== undefined && meta.defaultDisplayName !== '') {
        merged.defaultDisplayName = meta.defaultDisplayName;
    } else if (other.defaultDisplayName !== undefined) {
        merged.defaultDisplayName = other.defaultDisplayName;
    }

    return merged;
}

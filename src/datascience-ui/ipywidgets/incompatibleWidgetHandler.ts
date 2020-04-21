// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as semver from 'semver';
import { WidgetScriptSource } from '../../client/datascience/ipywidgets/types';
const supportedVersionOfQgrid = '1.1.1';
const qgridModuleName = 'qgrid';

/**
 * For now only warns about qgrid.
 * Warn user about qgrid versions > 1.1.1 (we know CDN isn't available for newer versions and local widget source will not work).
 * Recommend to downgrade to 1.1.1.
 * Returns `true` if a warning has been displayed.
 */
export function warnAboutWidgetVersionsThatAreNotSupported(
    widgetSource: WidgetScriptSource,
    moduleVersion: string,
    cdnSupported: boolean,
    errorDispatcher: (info: { moduleName: typeof qgridModuleName; moduleVersion: string }) => void
) {
    // if widget exists on CDN or CDN is disabled, get out.
    if (widgetSource.source === 'cdn' || !cdnSupported) {
        return false;
    }
    // Warn about qrid.
    if (widgetSource.moduleName !== qgridModuleName) {
        return false;
    }
    // We're only interested in versions > 1.1.1.
    try {
        // If we have an exact version, & if that is <= 1.1.1, then no warning needs to be displayed.
        if (!moduleVersion.startsWith('^') && semver.compare(moduleVersion, supportedVersionOfQgrid) <= 0) {
            return false;
        }
        // If we have a version range, then check the range.
        // Basically if our minimum version 1.1.1 is met, then nothing to do.
        // Eg. requesting script source for version `^1.3.0`.
        if (moduleVersion.startsWith('^') && semver.satisfies(supportedVersionOfQgrid, moduleVersion)) {
            return false;
        }
    } catch {
        return false;
    }
    errorDispatcher({ moduleName: widgetSource.moduleName, moduleVersion });
}

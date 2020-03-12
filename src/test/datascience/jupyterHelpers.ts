// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

// IP = * format is a bit different from localhost format
export function getIPConnectionInfo(output: string): string | undefined {
    // String format: http://(NAME or IP):PORT/
    const nameAndPortRegEx = /(https?):\/\/\(([^\s]*) or [0-9.]*\):([0-9]*)\/(?:\?token=)?([a-zA-Z0-9]*)?/;

    const urlMatch = nameAndPortRegEx.exec(output);
    if (urlMatch && !urlMatch[4]) {
        return `${urlMatch[1]}://${urlMatch[2]}:${urlMatch[3]}/`;
    } else if (urlMatch && urlMatch.length === 5) {
        return `${urlMatch[1]}://${urlMatch[2]}:${urlMatch[3]}/?token=${urlMatch[4]}`;
    }

    // In Notebook 6.0 instead of the above format it returns a single valid web address so just return that
    return getConnectionInfo(output);
}

export function getConnectionInfo(output: string): string | undefined {
    const UrlPatternRegEx = /(https?:\/\/[^\s]+)/;

    const urlMatch = UrlPatternRegEx.exec(output);
    if (urlMatch) {
        return urlMatch[0];
    }
    return undefined;
}

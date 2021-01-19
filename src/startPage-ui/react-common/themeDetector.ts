// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// From here:
// https://stackoverflow.com/questions/37257911/detect-light-dark-theme-programatically-in-visual-studio-code
// Detect vscode-light, vscode-dark, and vscode-high-contrast class name on the body element.
export function detectBaseTheme(): 'vscode-light' | 'vscode-dark' | 'vscode-high-contrast' {
    const { body } = document;
    if (body) {
        switch (body.className) {
            case 'vscode-light':
                return 'vscode-light';
            case 'vscode-dark':
                return 'vscode-dark';
            case 'vscode-high-contrast':
                return 'vscode-high-contrast';
            default:
                return 'vscode-light';
        }
    }

    return 'vscode-light';
}

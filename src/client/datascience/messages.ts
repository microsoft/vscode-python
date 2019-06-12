// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

export namespace CssMessages {
    export const GetCssRequest = 'get_css_request';
    export const GetCssResponse = 'get_css_response';
    export const GetMonacoThemeRequest = 'get_monaco_theme_request';
    export const GetMonacoThemeResponse = 'get_monaco_theme_response';
}

export namespace SharedMessages {
    export const UpdateSettings = 'update_settings';
    export const Started = 'started';
}

export interface IGetCssRequest {
    isDark: boolean;
}

export interface IGetMonacoThemeRequest {
    isDark: boolean;
}

export interface IGetCssResponse {
    css: string;
    theme: string;
    knownDark?: boolean;
}

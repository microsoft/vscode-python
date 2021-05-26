// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { LanguageConfiguration } from 'vscode';

export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;
export type JSONObject = { [member: string]: JSONValue };
export type JSONArray = JSONValue[];

export const IStartPage = Symbol('IStartPage');
export interface IStartPage {
    readonly initialMementoValue?: string;
    open(): Promise<void>;
    extensionVersionChanged(): Promise<boolean>;
}

export interface ISettingPackage {
    showAgainSetting: boolean;
}

export enum StartPageMessages {
    Started = 'started',
    UpdateSettings = 'update_settings',
    RequestShowAgainSetting = 'RequestShowAgainSetting',
    SendSetting = 'SendSetting',
    OpenBlankNotebook = 'OpenBlankNotebook',
    OpenBlankPythonFile = 'OpenBlankPythonFile',
    OpenInteractiveWindow = 'OpenInteractiveWindow',
    OpenCommandPalette = 'OpenCommandPalette',
    OpenCommandPaletteWithOpenNBSelected = 'OpenCommandPaletteWithOpenNBSelected',
    OpenSampleNotebook = 'OpenSampleNotebook',
    OpenFileBrowser = 'OpenFileBrowser',
    OpenFolder = 'OpenFolder',
    OpenWorkspace = 'OpenWorkspace',
}

export class IStartPageMapping {
    public [StartPageMessages.RequestShowAgainSetting]: ISettingPackage;

    public [StartPageMessages.SendSetting]: ISettingPackage;

    public [StartPageMessages.Started]: never | undefined;

    public [StartPageMessages.UpdateSettings]: boolean;

    public [StartPageMessages.OpenBlankNotebook]: never | undefined;

    public [StartPageMessages.OpenBlankPythonFile]: never | undefined;

    public [StartPageMessages.OpenInteractiveWindow]: never | undefined;

    public [StartPageMessages.OpenCommandPalette]: never | undefined;

    public [StartPageMessages.OpenCommandPaletteWithOpenNBSelected]: never | undefined;

    public [StartPageMessages.OpenSampleNotebook]: never | undefined;

    public [StartPageMessages.OpenFileBrowser]: never | undefined;

    public [StartPageMessages.OpenFolder]: never | undefined;

    public [StartPageMessages.OpenWorkspace]: never | undefined;
}

type WebViewViewState = {
    readonly visible: boolean;
    readonly active: boolean;
};
export type WebViewViewChangeEventArgs = { current: WebViewViewState; previous: WebViewViewState };

export const ICodeCssGenerator = Symbol('ICodeCssGenerator');
export interface ICodeCssGenerator {
    generateThemeCss(isDark: boolean, theme: string): Promise<string>;
    generateMonacoTheme(isDark: boolean, theme: string): Promise<JSONObject>;
}

export const IThemeFinder = Symbol('IThemeFinder');
export interface IThemeFinder {
    findThemeRootJson(themeName: string): Promise<string | undefined>;
    findTmLanguage(language: string): Promise<string | undefined>;
    findLanguageConfiguration(language: string): Promise<LanguageConfiguration | undefined>;
    isThemeDark(themeName: string): Promise<boolean | undefined>;
}

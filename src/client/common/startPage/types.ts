// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { JSONObject } from '@phosphor/coreutils';
import { LanguageConfiguration } from 'vscode';
import { IDataScienceSettings, Resource } from '../types';

export const IStartPage = Symbol('IStartPage');
export interface IStartPage {
    open(): Promise<void>;
    extensionVersionChanged(): Promise<boolean>;
}

export interface ISettingPackage {
    showAgainSetting: boolean;
}

export namespace StartPageMessages {
    export const Started = 'started';
    export const UpdateSettings = 'update_settings';
    export const RequestShowAgainSetting = 'RequestShowAgainSetting';
    export const SendSetting = 'SendSetting';
    export const OpenBlankNotebook = 'OpenBlankNotebook';
    export const OpenBlankPythonFile = 'OpenBlankPythonFile';
    export const OpenInteractiveWindow = 'OpenInteractiveWindow';
    export const OpenCommandPalette = 'OpenCommandPalette';
    export const OpenCommandPaletteWithOpenNBSelected = 'OpenCommandPaletteWithOpenNBSelected';
    export const OpenSampleNotebook = 'OpenSampleNotebook';
    export const OpenFileBrowser = 'OpenFileBrowser';
    export const OpenFolder = 'OpenFolder';
    export const OpenWorkspace = 'OpenWorkspace';
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
    generateThemeCss(resource: Resource, isDark: boolean, theme: string): Promise<string>;
    generateMonacoTheme(resource: Resource, isDark: boolean, theme: string): Promise<JSONObject>;
}

export const IThemeFinder = Symbol('IThemeFinder');
export interface IThemeFinder {
    findThemeRootJson(themeName: string): Promise<string | undefined>;
    findTmLanguage(language: string): Promise<string | undefined>;
    findLanguageConfiguration(language: string): Promise<LanguageConfiguration | undefined>;
    isThemeDark(themeName: string): Promise<boolean | undefined>;
}

export interface IDataScienceExtraSettings extends IDataScienceSettings {
    extraSettings: {
        editor: {
            cursor: string;
            cursorBlink: string;
            fontLigatures: boolean;
            autoClosingBrackets: string;
            autoClosingQuotes: string;
            autoSurround: string;
            autoIndent: boolean;
            scrollBeyondLastLine: boolean;
            horizontalScrollbarSize: number;
            verticalScrollbarSize: number;
            fontSize: number;
            fontFamily: string;
        };
        theme: string;
        useCustomEditorApi: boolean;
    };
    intellisenseOptions: {
        quickSuggestions: {
            other: boolean;
            comments: boolean;
            strings: boolean;
        };
        acceptSuggestionOnEnter: boolean | 'on' | 'smart' | 'off';
        quickSuggestionsDelay: number;
        suggestOnTriggerCharacters: boolean;
        tabCompletion: boolean | 'on' | 'off' | 'onlySnippets';
        suggestLocalityBonus: boolean;
        suggestSelection: 'first' | 'recentlyUsed' | 'recentlyUsedByPrefix';
        wordBasedSuggestions: boolean;
        parameterHintsEnabled: boolean;
    };
    variableOptions: {
        enableDuringDebugger: boolean;
    };

    gatherIsInstalled: boolean;
}

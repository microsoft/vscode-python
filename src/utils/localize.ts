// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as nls from 'vscode-nls';

import { inject, injectable } from 'inversify';
import { ConfigurationChangeEvent } from 'vscode';

import { IWorkspaceService } from '../client/common/application/types';
import { IDisposableRegistry } from '../client/common/types';
import { IServiceContainer } from '../client/ioc/types';

let locale: string;

// Different string values. They are set in the load function below.
// External callers of localize use these tables to retrieve localized values.
export namespace LanguageServiceSurveyBanner {
    export let bannerMessage: string;
    export let bannerLabelYes: string;
    export let bannerLabelNo: string;
}

// Function for parsing the current locale.
function parseNlsOptions() : nls.Options {
    // Attempt to load from the vscode locale. If not there, use english
    const vscodeConfigString = process.env.VSCODE_NLS_CONFIG;
    return vscodeConfigString ? JSON.parse(vscodeConfigString) : { locale: 'en-us' };
}

// Global load function that can get recalled when the language changes.
function load() {
    // Be very careful messing with the code below. It can mess up the parsing of the vscode-nls-dev tools if you
    // change it too much. (Example, extracting the config code into a function breaks it.)
    const vscodeConfigString = process.env.VSCODE_NLS_CONFIG;
    const config = vscodeConfigString ? JSON.parse(vscodeConfigString) : { locale: 'en-us' };

    // Try both bundles and files. Files make it work for this single file.
    config.messageFormat = nls.MessageFormat.both;
    const localize = nls.config(config)();

    // Save our locale we loaded for lookup later
    locale = config.locale;

    // Then reload all of our strings. This is necessary so we can reapply the language strings when the language changes in VS code
    // Note:
    // For every string you add here, it must be placed in the <root>/i18n/<lang>/out/utils/localize.i18n.json file as well.
    // For every language we support. The fallback is placed in this file.
    LanguageServiceSurveyBanner.bannerMessage = localize('LanguageServiceSurveyBanner.bannerMessage', 'Can you please take 2 minutes to tell us how the Python Language Server is working for you?');
    LanguageServiceSurveyBanner.bannerLabelYes = localize('LanguageServiceSurveyBanner.bannerLabelYes', 'Yes, take survey now');
    LanguageServiceSurveyBanner.bannerLabelNo = localize('LanguageServiceSurveyBanner.bannerLabelNo', 'No, thanks');
}

export const ILocalizationService = Symbol('ILocalizationService');
export interface ILocalizationService {
    initialize() : void;
}

// Special class that extension loads to listen for locale changes.
@injectable()
export class LocalizationService {
    private workspace: IWorkspaceService;
    private disposableRegistry: IDisposableRegistry;

    constructor(@inject(IServiceContainer) private serviceContainer: IServiceContainer)
    {
        this.workspace = this.serviceContainer.get<IWorkspaceService>(IWorkspaceService);
        this.disposableRegistry = this.serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);

    }

    public initialize() {
        this.disposableRegistry.push(this.workspace.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this)));
    }

    private async onDidChangeConfiguration(event: ConfigurationChangeEvent) {
        // Parse the current locale and see if it changed or not
        const currentLocale = parseNlsOptions().locale;
        if (currentLocale !== locale) {

            // Locale changed, reload our strings
            load();
        }
    }
}

// Default to calling load with the current process values. This lets localize work without having an extension loaded
load();

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// tslint:disable:trailing-comma no-any
// tslint:disable-next-line: no-single-line-block-comment
/* eslint-disable */
import { ReactWrapper } from 'enzyme';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import { interfaces } from 'inversify';
import * as os from 'os';
import { anything, instance, mock, reset, when } from 'ts-mockito';
import * as TypeMoq from 'typemoq';
import { promisify } from 'util';
import * as vsls from 'vsls/vscode';

import { IExtensionSingleActivationService } from '../../client/activation/types';
import { ApplicationEnvironment } from '../../client/common/application/applicationEnvironment';
import {
    IApplicationEnvironment,
    ILiveShareApi,
    ILiveShareTestingApi,
    IWebviewPanelOptions,
    IWebviewPanelProvider
} from '../../client/common/application/types';
import { WebviewPanelProvider } from '../../client/common/application/webviewPanels/webviewPanelProvider';
import { AsyncDisposableRegistry } from '../../client/common/asyncDisposableRegistry';
import { LocalZMQKernel } from '../../client/common/experiments/groups';
import { ExperimentsManager } from '../../client/common/experiments/manager';
import { ExperimentService } from '../../client/common/experiments/service';
import { InstallationChannelManager } from '../../client/common/installer/channelManager';
import { IInstallationChannelManager } from '../../client/common/installer/types';
import { HttpClient } from '../../client/common/net/httpClient';
import { CodeCssGenerator } from '../../client/common/startPage/codeCssGenerator';
import { StartPage } from '../../client/common/startPage/startPage';
import { ThemeFinder } from '../../client/common/startPage/themeFinder';
import { ICodeCssGenerator, IStartPage, IThemeFinder } from '../../client/common/startPage/types';
import { IExperimentService, IExtensionContext, IHttpClient } from '../../client/common/types';
import { sleep } from '../../client/common/utils/async';

import { EnvironmentActivationServiceCache } from '../../client/interpreter/activation/service';

import { CacheableLocatorPromiseCache } from '../../client/pythonEnvironments/discovery/locators/services/cacheableLocatorService';
import { UnitTestIocContainer } from '../testing/serviceRegistry';
import { IMountedWebView } from './mountedWebView';
import { IMountedWebViewFactory } from './mountedWebViewFactory';
import { WebBrowserPanelProvider } from './webBrowserPanelProvider';

export class DataScienceIocContainer extends UnitTestIocContainer {
    public shouldMockJupyter: boolean;

    private asyncRegistry: AsyncDisposableRegistry;

    private webPanelProvider = mock(WebviewPanelProvider);

    private settingsMap = new Map<string, any>();

    private experimentState = new Map<string, boolean>();

    private extensionRootPath: string | undefined;

    private pendingWebPanel: IMountedWebView | undefined;

    constructor(private readonly uiTest: boolean = false) {
        super();
        // this.pythonEnvs = mock(PythonEnvironments);
        this.useVSCodeAPI = false;
        const isRollingBuild = process.env ? process.env.VSCODE_PYTHON_ROLLING !== undefined : false;
        this.shouldMockJupyter = !isRollingBuild;
        this.asyncRegistry = new AsyncDisposableRegistry();
    }

    public async dispose(): Promise<void> {
        try {
            // Make sure to delete any temp files written by native editor storage
            const globPr = promisify(glob);
            const tempLocation = os.tmpdir;
            const tempFiles = await globPr(`${tempLocation}/*.ipynb`);
            if (tempFiles && tempFiles.length) {
                await Promise.all(tempFiles.map((t) => fs.remove(t)));
            }
        } catch (exc) {
            // tslint:disable-next-line: no-console
            console.log(`Exception on cleanup: ${exc}`);
        }
        await this.asyncRegistry.dispose();
        await super.dispose();

        if (!this.uiTest) {
            // Blur window focus so we don't have editors polling
            // tslint:disable-next-line: no-require-imports
            const reactHelpers = require('./reactHelpers') as typeof import('./reactHelpers');
            reactHelpers.blurWindow();
        }

        // Bounce this so that our editor has time to shutdown
        await sleep(150);

        if (!this.uiTest) {
            // Clear out the monaco global services. Some of these services are preventing shutdown.
            // tslint:disable: no-require-imports
            const services = require('monaco-editor/esm/vs/editor/standalone/browser/standaloneServices') as any;
            if (services.StaticServices) {
                const keys = Object.keys(services.StaticServices);
                keys.forEach((k) => {
                    const service = services.StaticServices[k] as any;
                    if (service && service._value && service._value.dispose) {
                        if (typeof service._value.dispose === 'function') {
                            service._value.dispose();
                        }
                    }
                });
            }
            // This file doesn't have an export so we can't force a dispose. Instead it has a 5 second timeout
            const config = require('monaco-editor/esm/vs/editor/browser/config/configuration') as any;
            if (config.getCSSBasedConfiguration) {
                config.getCSSBasedConfiguration().dispose();
            }
        }

        // Because there are outstanding promises holding onto this object, clear out everything we can
        this.settingsMap.clear();
        reset(this.webPanelProvider);
    }

    // tslint:disable:max-func-body-length
    public registerDataScienceTypes() {
        // this.serviceManager.addSingletonInstance<number>(DataScienceStartupTime, Date.now());
        this.serviceManager.addSingletonInstance<DataScienceIocContainer>(DataScienceIocContainer, this);

        // Inform the cacheable locator service to use a static map so that it stays in memory in between tests
        CacheableLocatorPromiseCache.forceUseStatic();

        // Do the same thing for the environment variable activation service.
        EnvironmentActivationServiceCache.forceUseStatic();

        // Setup our webpanel provider to create our dummy web panel
        when(this.webPanelProvider.create(anything())).thenCall(this.onCreateWebPanel.bind(this));
        if (this.uiTest) {
            this.serviceManager.addSingleton<IWebviewPanelProvider>(IWebviewPanelProvider, WebBrowserPanelProvider);
            this.serviceManager.addSingleton<IHttpClient>(IHttpClient, HttpClient);
        } else {
            this.serviceManager.addSingletonInstance<IWebviewPanelProvider>(
                IWebviewPanelProvider,
                instance(this.webPanelProvider)
            );
        }

        this.serviceManager.add<IStartPage>(IStartPage, StartPage);

        const experimentService = mock(ExperimentService);
        this.serviceManager.addSingletonInstance<IExperimentService>(IExperimentService, instance(experimentService));

        this.serviceManager.addSingleton<IApplicationEnvironment>(IApplicationEnvironment, ApplicationEnvironment);

        this.serviceManager.addSingleton<IThemeFinder>(IThemeFinder, ThemeFinder);
        this.serviceManager.addSingleton<ICodeCssGenerator>(ICodeCssGenerator, CodeCssGenerator);

        this.serviceManager.add<IInstallationChannelManager>(IInstallationChannelManager, InstallationChannelManager);

        const mockExtensionContext = TypeMoq.Mock.ofType<IExtensionContext>();
        mockExtensionContext.setup((m) => m.globalStoragePath).returns(() => os.tmpdir());
        mockExtensionContext.setup((m) => m.extensionPath).returns(() => this.extensionRootPath || os.tmpdir());
        this.serviceManager.addSingletonInstance<IExtensionContext>(IExtensionContext, mockExtensionContext.object);

        // Turn off experiments.
        const experimentManager = mock(ExperimentsManager);
        when(experimentManager.inExperiment(anything())).thenCall((exp) => {
            const setState = this.experimentState.get(exp);
            if (setState === undefined) {
                if (this.shouldMockJupyter) {
                    // RawKernel doesn't currently have a mock layer
                    return exp !== LocalZMQKernel.experiment;
                }
                // All experiments to true by default if not mocking jupyter
                return true;
            }
            return setState;
        });
    }

    public async activate(): Promise<void> {
        // Activate all of the extension activation services
        const activationServices = this.serviceManager.getAll<IExtensionSingleActivationService>(
            IExtensionSingleActivationService
        );

        await Promise.all(activationServices.map((a) => a.activate()));
    }

    // tslint:disable:any
    public createWebView(
        mount: () => ReactWrapper<any, Readonly<{}>, React.Component>,
        id: string,
        role: vsls.Role = vsls.Role.None
    ) {
        // Force the container to mock actual live share if necessary
        if (role !== vsls.Role.None) {
            const liveShareTest = this.get<ILiveShareApi>(ILiveShareApi) as ILiveShareTestingApi;
            liveShareTest.forceRole(role);
        }

        // We need to mount the react control before we even create an interactive window object. Otherwise the mount will miss rendering some parts
        this.pendingWebPanel = this.get<IMountedWebViewFactory>(IMountedWebViewFactory).create(id, mount);
        return this.pendingWebPanel;
    }

    public get<T>(serviceIdentifier: interfaces.ServiceIdentifier<T>, name?: string | number | symbol): T {
        return this.serviceManager.get<T>(serviceIdentifier, name);
    }

    private async onCreateWebPanel(options: IWebviewPanelOptions) {
        if (!this.pendingWebPanel) {
            throw new Error('Creating web panel without a mount');
        }
        const panel = this.pendingWebPanel;
        panel.attach(options);
        return panel;
    }
}

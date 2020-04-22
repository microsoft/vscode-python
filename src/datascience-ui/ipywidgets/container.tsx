// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as isonline from 'is-online';
import * as React from 'react';
import { Store } from 'redux';
import '../../client/common/extensions';
import { createDeferred, Deferred } from '../../client/common/utils/async';
import {
    IInteractiveWindowMapping,
    IPyWidgetMessages
} from '../../client/datascience/interactive-common/interactiveWindowTypes';
import { WidgetScriptSource } from '../../client/datascience/ipywidgets/types';
import { SharedMessages } from '../../client/datascience/messages';
import { IDataScienceExtraSettings } from '../../client/datascience/types';
import {
    CommonAction,
    CommonActionType,
    ILoadIPyWidgetClassFailureAction,
    LoadIPyWidgetClassLoadAction,
    NotifyIPyWidgeWidgetVersionNotSupportedAction
} from '../interactive-common/redux/reducers/types';
import { IStore } from '../interactive-common/redux/store';
import { PostOffice } from '../react-common/postOffice';
import { warnAboutWidgetVersionsThatAreNotSupported } from './incompatibleWidgetHandler';
import { WidgetManager } from './manager';
import { registerScripts } from './requirejsRegistry';

type Props = {
    postOffice: PostOffice;
    widgetContainerId: string;
    store: Store<IStore> & { dispatch: unknown };
};

export class WidgetManagerComponent extends React.Component<Props> {
    private readonly widgetManager: WidgetManager;
    private readonly widgetSourceRequests = new Map<string, Deferred<void>>();
    private readonly registeredWidgetSources = new Map<string, WidgetScriptSource>();
    private timedoutWaitingForWidgetsToGetLoaded?: boolean;
    private widgetsCanLoadFromCDN: boolean = false;
    private readonly loaderSettings = {
        // Total time to wait for a script to load. This includes ipywidgets making a request to extension for a Uri of a widget,
        // then extension replying back with the Uri (max 5 seconds round trip time).
        // If expires, then Widget downloader will attempt to download with what ever information it has (potentially failing).
        // Note, we might have a message displayed at the user end (asking for consent to use CDN).
        // Hence use 60 seconds.
        timeoutWaitingForScriptToLoad: 60_000,
        // List of widgets that must always be loaded using requirejs instead of using a CDN or the like.
        widgetsRegisteredInRequireJs: new Set<string>(),
        // Callback when loading a widget fails.
        errorHandler: this.handleLoadError.bind(this),
        // Callback when requesting a module be registered with requirejs (if possible).
        loadWidgetScript: this.loadWidgetScript.bind(this),
        successHandler: this.handleLoadSuccess.bind(this)
    };
    constructor(props: Props) {
        super(props);
        this.widgetManager = new WidgetManager(
            document.getElementById(this.props.widgetContainerId)!,
            this.props.postOffice,
            this.loaderSettings
        );

        props.postOffice.addHandler({
            // tslint:disable-next-line: no-any
            handleMessage: (type: string, payload?: any) => {
                if (type === SharedMessages.UpdateSettings) {
                    const settings = JSON.parse(payload) as IDataScienceExtraSettings;
                    this.widgetsCanLoadFromCDN = settings.widgetScriptSources.length > 0;
                } else if (type === IPyWidgetMessages.IPyWidgets_WidgetScriptSourceResponse) {
                    this.registerScriptSourceInRequirejs(payload as WidgetScriptSource);
                } else if (
                    type === IPyWidgetMessages.IPyWidgets_kernelOptions ||
                    type === IPyWidgetMessages.IPyWidgets_onKernelChanged
                ) {
                    // This happens when we have restarted a kernel.
                    // If user changed the kernel, then some widgets might exist now and some might now.
                    this.widgetSourceRequests.clear();
                    this.registeredWidgetSources.clear();
                }
                return true;
            }
        });
    }
    public render() {
        return null;
    }
    public componentWillUnmount() {
        this.widgetManager.dispose();
    }
    /**
     * Given a list of the widgets along with the sources, we will need to register them with requirejs.
     * IPyWidgets uses requirejs to dynamically load modules.
     * (https://requirejs.org/docs/api.html)
     * All we're doing here is given a widget (module) name, we register the path where the widget (module) can be loaded from.
     * E.g.
     * requirejs.config({ paths:{
     *  'widget_xyz': '<Url of script without trailing .js>'
     * }});
     */
    private registerScriptSourcesInRequirejs(sources: WidgetScriptSource[]) {
        if (!Array.isArray(sources) || sources.length === 0) {
            return;
        }

        registerScripts(sources);

        // Now resolve promises (anything that was waiting for modules to get registered can carry on).
        sources.forEach((source) => {
            this.registeredWidgetSources.set(source.moduleName, source);
            // We have fetched the script sources for all of these modules.
            // In some cases we might not have the source, meaning we don't have it or couldn't find it.
            let deferred = this.widgetSourceRequests.get(source.moduleName);
            if (!deferred) {
                deferred = createDeferred();
                this.widgetSourceRequests.set(source.moduleName, deferred);
            }
            deferred.resolve();
        });
    }
    private registerScriptSourceInRequirejs(source?: WidgetScriptSource) {
        if (!source) {
            return;
        }
        this.registerScriptSourcesInRequirejs([source]);
    }
    private createLoadSuccessAction(
        className: string,
        moduleName: string,
        moduleVersion: string
    ): CommonAction<LoadIPyWidgetClassLoadAction> {
        return {
            type: CommonActionType.LOAD_IPYWIDGET_CLASS_SUCCESS,
            payload: { messageDirection: 'incoming', data: { className, moduleName, moduleVersion } }
        };
    }

    private createLoadErrorAction(
        className: string,
        moduleName: string,
        moduleVersion: string,
        isOnline: boolean,
        // tslint:disable-next-line: no-any
        error: any,
        timedout: boolean
    ): CommonAction<ILoadIPyWidgetClassFailureAction> {
        return {
            type: CommonActionType.LOAD_IPYWIDGET_CLASS_FAILURE,
            payload: {
                messageDirection: 'incoming',
                data: {
                    className,
                    moduleName,
                    moduleVersion,
                    isOnline,
                    timedout,
                    error,
                    cdnsUsed: this.widgetsCanLoadFromCDN
                }
            }
        };
    }
    private createWidgetVersionNotSupportedErrorAction(
        moduleName: 'qgrid',
        moduleVersion: string
    ): CommonAction<NotifyIPyWidgeWidgetVersionNotSupportedAction> {
        return {
            type: CommonActionType.IPYWIDGET_WIDGET_VERSION_NOT_SUPPORTED,
            payload: {
                messageDirection: 'incoming',
                data: {
                    moduleName,
                    moduleVersion
                }
            }
        };
    }
    private async handleLoadError(
        className: string,
        moduleName: string,
        moduleVersion: string,
        // tslint:disable-next-line: no-any
        error: any,
        timedout: boolean = false
    ) {
        const isOnline = await isonline.default({ timeout: 1000 });
        this.props.store.dispatch(
            this.createLoadErrorAction(className, moduleName, moduleVersion, isOnline, error, timedout)
        );
    }

    /**
     * Method called by ipywidgets to get the source for a widget.
     * When we get a source for the widget, we register it in requriejs.
     * We need to check if it is avaialble on CDN, if not then fallback to local FS.
     * Or check local FS then fall back to CDN (depending on the order defined by the user).
     */
    private loadWidgetScript(moduleName: string, moduleVersion: string): Promise<void> {
        // tslint:disable-next-line: no-console
        console.log(`Fetch IPyWidget source for ${moduleName}`);
        let deferred = this.widgetSourceRequests.get(moduleName);
        if (!deferred) {
            deferred = createDeferred<void>();
            this.widgetSourceRequests.set(moduleName, deferred);

            // If we timeout, then resolve this promise.
            // We don't want the calling code to unnecessary wait for too long.
            // Else UI will not get rendered due to blocking ipywidets (at the end of the day ipywidgets gets loaded via kernel)
            // And kernel blocks the UI from getting processed.
            // Also, if we timeout once, then for subsequent attempts, wait for just 1 second.
            // Possible user has ignored some UI prompt and things are now in a state of limbo.
            // This way thigns will fall over sooner due to missing widget sources.
            const timeoutTime = this.timedoutWaitingForWidgetsToGetLoaded
                ? 10_000
                : this.loaderSettings.timeoutWaitingForScriptToLoad;

            setTimeout(() => {
                // tslint:disable-next-line: no-console
                console.error(`Timeout waiting to get widget source for ${moduleName}, ${moduleVersion}`);
                this.handleLoadError('<class>', moduleName, moduleVersion, new Error('Timeout'), true).ignoreErrors();
                if (deferred) {
                    deferred.resolve();
                }
                this.timedoutWaitingForWidgetsToGetLoaded = true;
            }, timeoutTime);
        }
        // Whether we have the scripts or not, send message to extension.
        // Useful telemetry and also we know it was explicity requestd by ipywidgest.
        this.props.postOffice.sendMessage<IInteractiveWindowMapping>(
            IPyWidgetMessages.IPyWidgets_WidgetScriptSourceRequest,
            { moduleName, moduleVersion }
        );

        return deferred.promise
            .then(() => {
                const widgetSource = this.registeredWidgetSources.get(moduleName);
                if (widgetSource) {
                    warnAboutWidgetVersionsThatAreNotSupported(
                        widgetSource,
                        moduleVersion,
                        this.widgetsCanLoadFromCDN,
                        (info) =>
                            this.props.store.dispatch(
                                this.createWidgetVersionNotSupportedErrorAction(info.moduleName, info.moduleVersion)
                            )
                    );
                }
            })
            .catch((ex) =>
                // tslint:disable-next-line: no-console
                console.error(`Failed to load Widget Script from Extension for for ${moduleName}, ${moduleVersion}`, ex)
            );
    }

    private handleLoadSuccess(className: string, moduleName: string, moduleVersion: string) {
        this.props.store.dispatch(this.createLoadSuccessAction(className, moduleName, moduleVersion));
    }
}

import { ISettingRegistry } from '@jupyterlab/coreutils';
import * as $ from 'jquery';

let _settingRegistry: ISettingRegistry;

/**
 * Initialize logger with the settings registry, so that the logger can access the user's ID.
 */
export function initLogger(settingRegistry: ISettingRegistry) {
    _settingRegistry = settingRegistry;
}

let _statePollers: IStatePoller[] = [];

/**
 * Interface for a class that polls the state to get logging information at each log action.
 */
export interface IStatePoller {
    /**
     * Gets called on every log statement; returns JSON that should be logged.
     */
    poll(): any;
}

/**
 * Register a state poller to add information to the log on each log call.
 */
export function registerPollers(...pollers: IStatePoller[]) {
    _statePollers.push(...pollers);
}

/**
 * Log pretty much any data. Fail silently if the request can't be completed (i.e. if the user's
 * computer is not connnected to the internet). Must initialize logger with `initLogger` before
 * calling this method. Call this after a batch of operations instead of each item, as calls
 * can take a while.
 */
export function log(eventName: string, data?: any) {
    data = data || {};

    let LOG_ENDPOINT = 'https://clarence.eecs.berkeley.edu';

    // Prepare log data.
    let postData: any = {
        timestamp: new Date().toISOString(),
        event: eventName,
        data: data,
        loggingId: undefined
    };

    if (_settingRegistry != undefined || _settingRegistry != null) {
        _settingRegistry.get('nbgather:plugin', 'loggingEnabled').then(loggingEnabled => {
            if (typeof loggingEnabled.composite === 'boolean' && loggingEnabled.composite) {
                _settingRegistry.get('nbgather:plugin', 'loggingId').then(loggingId => {
                    if (typeof loggingId.composite === 'string') {
                        postData.loggingId = loggingId.composite as string;

                        // Poll for additional data from each state poller.
                        for (let poller of _statePollers) {
                            let pollData = poller.poll();
                            for (let k in pollData) {
                                if (pollData.hasOwnProperty(k)) {
                                    postData[k] = pollData[k];
                                }
                            }
                        }

                        // If there is any sensitive data to be logged, it should first be cleaned through a
                        // `toJSON` method defined on a class, or manually before passing it into this method.
                        // Earlier, we used the replacer argument to JSON.stringify, but it takes too much time
                        // to apply replacers to every value in the resulting JSON.
                        postData.data = JSON.stringify(postData.data);

                        // Submit data to logger endpoint.
                        $.ajax(LOG_ENDPOINT + '/log', {
                            data: postData,
                            method: 'POST',
                            error: (_: any, textStatus: string, errorThrown: string) => {
                                console.error('Failed to log', textStatus, errorThrown);
                            }
                        });
                    }
                });
            }
        });
    }
}

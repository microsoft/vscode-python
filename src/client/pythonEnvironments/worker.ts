/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable no-restricted-globals */
import { parentPort } from 'worker_threads';
import { createLocator } from './createLocator';
import { IDiscoveryAPI } from './base/locator';
import { ExtensionState } from '../components';
import { PythonEnvironments } from './apiImplementation';

let discoveryAPI: IDiscoveryAPI;

if (!parentPort) {
    throw new Error('Not in a worker thread');
}

parentPort.postMessage('1 Hello world!');

console.log('Worker thread started');

// // Listen for messages from the main thread
parentPort.on('message', async (event) => {
    console.log('Worker thread received message', event);
    if (!parentPort) {
        throw new Error('Not in a worker thread');
    }
    const { methodName, args } = event;
    const x = 2;
    if (methodName === 'activate') {
        // Initialize the class instance with the provided arguments
        try {
            discoveryAPI = new PythonEnvironments();
            console.log('Worker thread calling activate');
        } catch (error) {
            parentPort.postMessage({ methodName, error: (error as Error).message });
        }
    }
    const y = 2;
    // if (methodName && typeof discoveryAPI[methodName as keyof IDiscoveryAPI] === 'function') {
    //     const method = discoveryAPI[methodName as keyof IDiscoveryAPI] as Function;
    //     try {
    //         const result = await method.apply(discoveryAPI, ...args);
    //         parentPort.postMessage({ methodName,result });
    //     } catch (error) {
    //         parentPort.postMessage({ methodName,error: (error as Error).message });
    //     }
    // } else {
    //     parentPort.postMessage({ methodName,error: 'Invalid method name' });
    // }
    parentPort.postMessage({ methodName, error: 'Invalid method name' });
});

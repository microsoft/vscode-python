// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { Action, AnyAction, Middleware, Reducer } from 'redux';

// tslint:disable-next-line: interface-name
interface TypedAnyAction<T> extends Action<T> {
    // Allows any extra properties to be defined in an action.
    // tslint:disable-next-line: no-any
    [extraProps: string]: any;
}
export type QueueAnotherFunc<T> = (nextAction: Action<T>) => void;
export type QueuableAction<M> = TypedAnyAction<keyof M> & { queueAction: QueueAnotherFunc<keyof M> };
export type ReducerArg<S, AT, T> = T extends null | undefined
    ? {
          prevState: S;
          queueAction: QueueAnotherFunc<AT>;
      }
    : {
          prevState: S;
          queueAction: QueueAnotherFunc<AT>;
          payload: T;
      };

export type ReducerFunc<S, AT, T> = (args: ReducerArg<S, AT, T>) => S;

export type ActionWithPayload<T, K> = T extends null | undefined
    ? TypedAnyAction<K>
    : TypedAnyAction<K> & { payload: T };

/**
 * CombineReducers takes in a map of action.type to func and creates a reducer that will call the appropriate function for
 * each action
 * @param defaultState - original state to use for the store
 * @param postMessage - function passed in to use to post messages back to the extension
 * @param map - map of action type to func to call
 */
export function combineReducers<S, M>(defaultState: S, map: M): Reducer<S, QueuableAction<M>> {
    return (currentState: S = defaultState, action: QueuableAction<M>) => {
        const func = map[action.type];
        if (typeof func === 'function') {
            // Call the reducer, giving it
            // - current state
            // - function to potentially post stuff to the other side
            // - queue function to dispatch again
            // - payload containing the data from the action
            return func({ prevState: currentState, queueAction: action.queueAction, payload: action.payload });
        } else {
            return currentState;
        }
    };
}

// This middleware allows a reducer to dispatch another action after the reducer
// has returned state (it queues up the dispatch).
//
// Got this idea from here:
// https://stackoverflow.com/questions/36730793/can-i-dispatch-an-action-in-reducer
//
// Careful when using the queueAction though. Don't store it past the point of a reducer as
// the local state inside of this middleware function will be wrong.
export function createQueueableActionMiddleware(): Middleware {
    return store => next => action => {
        let pendingActions: Action[] = [];
        let complete = false;

        function flush() {
            pendingActions.forEach(a => store.dispatch(a));
            pendingActions = [];
        }

        function queueAction(nextAction: AnyAction) {
            pendingActions.push(nextAction);

            // If already done, run the pending actions (this means
            // this was pushed async)
            if (complete) {
                flush();
            }
        }

        // Add queue to the action
        const modifiedAction = { ...action, queueAction };

        // Call the next item in the middle ware chain
        const res = next(modifiedAction);

        // When done, run all the queued actions
        complete = true;
        flush();

        return res;
    };
}

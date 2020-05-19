// These are all just temporary aliases, for backward compatibility

export { traceDecorators } from '../logging/_global';

// and to avoid churn.
export {
    logError as traceError,
    logInfo as traceInfo,
    logVerbose as traceVerbose,
    logWarning as traceWarning
} from '../logging';
export { TraceOptions as LogOptions } from '../logging/trace';

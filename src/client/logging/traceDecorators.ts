import { TraceDecoratorType } from '../common/utils/decorators';
import { LogLevel } from './levels';
import { createTracingDecorator, TraceOptions } from './trace';
import { getGlobalLogger } from './_global';

const DEFAULT_OPTS: TraceOptions = TraceOptions.Arguments | TraceOptions.ReturnValue;

export function verbose(message: string, opts: TraceOptions = DEFAULT_OPTS): TraceDecoratorType {
    const globalLogger = getGlobalLogger();
    return createTracingDecorator([globalLogger], { message, opts });
}
export function error(message: string): TraceDecoratorType {
    const opts = DEFAULT_OPTS;
    const level = LogLevel.Error;
    const globalLogger = getGlobalLogger();
    return createTracingDecorator([globalLogger], { message, opts, level });
}
export function info(message: string): TraceDecoratorType {
    const opts = TraceOptions.None;
    const globalLogger = getGlobalLogger();
    return createTracingDecorator([globalLogger], { message, opts });
}
export function warn(message: string): TraceDecoratorType {
    const opts = DEFAULT_OPTS;
    const level = LogLevel.Warn;
    const globalLogger = getGlobalLogger();
    return createTracingDecorator([globalLogger], { message, opts, level });
}

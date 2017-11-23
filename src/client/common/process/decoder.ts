import * as iconv from 'iconv-lite';
import { injectable } from 'inversify';
import 'reflect-metadata';
import { DEFAULT_ENCODING } from './constants';
import { IBufferDecoder } from './types';

@injectable()
export class BufferDecoder implements IBufferDecoder {
    public decode(buffers: Buffer[], encoding: string = DEFAULT_ENCODING): string {
        encoding = iconv.encodingExists(encoding) ? encoding : DEFAULT_ENCODING;
        return iconv.decode(Buffer.concat(buffers), encoding);
    }
}

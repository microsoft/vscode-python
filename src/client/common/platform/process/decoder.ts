import * as iconv from 'iconv-lite';
import { DEFAULT_ENCODING } from './constants';
import { IBufferDecoder } from './types';

export class BufferDecoder implements IBufferDecoder {
    public decode(buffers: Buffer[], encoding: string = DEFAULT_ENCODING): string {
        encoding = iconv.encodingExists(encoding) ? encoding : DEFAULT_ENCODING;
        return iconv.decode(Buffer.concat(buffers), encoding);
    }
}

//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// Place this right on top
// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as net from 'net';
import { SocketStream } from '../../client/common/net/socket/SocketStream';
// tslint:disable:no-require-imports no-var-requires
const uint64be = require('uint64be');

class MockSocket {
    private _data: string;
    // tslint:disable-next-line:no-any
    private _rawDataWritten: any;
    constructor() {
        this._data = '';
    }
    public get dataWritten(): string {
        return this._data;
    }
    // tslint:disable-next-line:no-any
    public get rawDataWritten(): any {
        return this._rawDataWritten;
    }
    // tslint:disable-next-line:no-any
    public write(data: any) {
        this._data = `${data}` + '';
        this._rawDataWritten = data;
    }
}
// Defines a Mocha test suite to group tests of similar kind together
// tslint:disable-next-line:max-func-body-length
suite('SocketStream', () => {
    test('Read Byte', (done) => {
        const buffer = new Buffer('X');
        const byteValue = buffer[0];
        const socket = new MockSocket();
        // tslint:disable-next-line:no-any
        const stream = new SocketStream((socket as any) as net.Socket, buffer);

        assert.equal(stream.ReadByte(), byteValue);
        done();
    });
    test('Read Int32', (done) => {
        const num = 1234;
        const socket = new MockSocket();
        const buffer = uint64be.encode(num);
        // tslint:disable-next-line:no-any
        const stream = new SocketStream((socket as any) as net.Socket, buffer);

        assert.equal(stream.ReadInt32(), num);
        done();
    });
    test('Read Int64', (done) => {
        const num = 9007199254740993;
        const socket = new MockSocket();
        const buffer = uint64be.encode(num);
        // tslint:disable-next-line:no-any
        const stream = new SocketStream((socket as any) as net.Socket, buffer);

        assert.equal(stream.ReadInt64(), num);
        done();
    });
    test('Read Ascii String', (done) => {
        const message = 'Hello World';
        const socket = new MockSocket();
        const buffer = Buffer.concat([new Buffer('A'), uint64be.encode(message.length), new Buffer(message)]);
        // tslint:disable-next-line:no-any
        const stream = new SocketStream((socket as any) as net.Socket, buffer);

        assert.equal(stream.ReadString(), message);
        done();
    });
    test('Read Unicode String', (done) => {
        const message = 'Hello World - Функция проверки ИНН и КПП - 说明';
        const socket = new MockSocket();
        const stringBuffer = new Buffer(message);
        const buffer = Buffer.concat([
            Buffer.concat([new Buffer('U'), uint64be.encode(stringBuffer.byteLength)]),
            stringBuffer,
        ]);
        // tslint:disable-next-line:no-any
        const stream = new SocketStream((socket as any) as net.Socket, buffer);

        assert.equal(stream.ReadString(), message);
        done();
    });
    test('Read RollBackTransaction', (done) => {
        const message = 'Hello World';
        const socket = new MockSocket();
        let buffer = Buffer.concat([new Buffer('A'), uint64be.encode(message.length), new Buffer(message)]);

        // Write part of a second message
        const partOfSecondMessage = Buffer.concat([new Buffer('A'), uint64be.encode(message.length)]);
        buffer = Buffer.concat([buffer, partOfSecondMessage]);
        // tslint:disable-next-line:no-any
        const stream = new SocketStream((socket as any) as net.Socket, buffer);

        stream.BeginTransaction();
        assert.equal(stream.ReadString(), message, 'First message not read properly');
        stream.ReadString();
        assert.equal(stream.HasInsufficientDataForReading, true, 'Should not have sufficient data for reading');
        stream.RollBackTransaction();
        assert.equal(stream.ReadString(), message, 'First message not read properly after rolling back transaction');
        done();
    });
    test('Read EndTransaction', (done) => {
        const message = 'Hello World';
        const socket = new MockSocket();
        let buffer = Buffer.concat([new Buffer('A'), uint64be.encode(message.length), new Buffer(message)]);

        // Write part of a second message
        const partOfSecondMessage = Buffer.concat([new Buffer('A'), uint64be.encode(message.length)]);
        buffer = Buffer.concat([buffer, partOfSecondMessage]);
        // tslint:disable-next-line:no-any
        const stream = new SocketStream((socket as any) as net.Socket, buffer);

        stream.BeginTransaction();
        assert.equal(stream.ReadString(), message, 'First message not read properly');
        stream.ReadString();
        assert.equal(stream.HasInsufficientDataForReading, true, 'Should not have sufficient data for reading');
        stream.EndTransaction();
        stream.RollBackTransaction();
        assert.notEqual(stream.ReadString(), message, 'First message cannot be read after commit transaction');
        done();
    });
    test('Write Buffer', (done) => {
        const message = 'Hello World';
        const buffer = new Buffer('');
        const socket = new MockSocket();
        // tslint:disable-next-line:no-any
        const stream = new SocketStream((socket as any) as net.Socket, buffer);
        stream.Write(new Buffer(message));

        assert.equal(socket.dataWritten, message);
        done();
    });
    test('Write Int32', (done) => {
        const num = 1234;
        const buffer = new Buffer('');
        const socket = new MockSocket();
        // tslint:disable-next-line:no-any
        const stream = new SocketStream((socket as any) as net.Socket, buffer);
        stream.WriteInt32(num);

        assert.equal(uint64be.decode(socket.rawDataWritten), num);
        done();
    });
    test('Write Int64', (done) => {
        const num = 9007199254740993;
        const buffer = new Buffer('');
        const socket = new MockSocket();
        // tslint:disable-next-line:no-any
        const stream = new SocketStream((socket as any) as net.Socket, buffer);
        stream.WriteInt64(num);

        assert.equal(uint64be.decode(socket.rawDataWritten), num);
        done();
    });
    test('Write Ascii String', (done) => {
        const message = 'Hello World';
        const buffer = new Buffer('');
        const socket = new MockSocket();
        // tslint:disable-next-line:no-any
        const stream = new SocketStream((socket as any) as net.Socket, buffer);
        stream.WriteString(message);

        assert.equal(socket.dataWritten, message);
        done();
    });
    test('Write Unicode String', (done) => {
        const message = 'Hello World - Функция проверки ИНН и КПП - 说明';
        const buffer = new Buffer('');
        const socket = new MockSocket();
        // tslint:disable-next-line:no-any
        const stream = new SocketStream((socket as any) as net.Socket, buffer);
        stream.WriteString(message);

        assert.equal(socket.dataWritten, message);
        done();
    });
});

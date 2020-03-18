// @ts-nocheck
/*
 * BSD 3-Clause License
 *
 * Copyright (c) 2015, Nicolas Riesco and others as credited in the AUTHORS file
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its contributors
 * may be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */

var crypto = require("crypto");
var uuid = require("uuid/v4");
var zmq = require("zeromq/v5-compat");

//var DEBUG = global.DEBUG || false;

//var log;
//if (DEBUG) {
//var console = require("console");
//log = function log() {
//process.stderr.write("JMP: ");
//console.error.apply(this, arguments);
//};
//} else {
//try {
//log = require("debug")("JMP:");
//} catch (err) {
//log = function noop() { };
//}
//}

var log;
log = function noop() { };


/**
 * @module jmp
 *
 * @description Module `jmp` provides functionality for creating, parsing and
 * replying to messages of the Jupyter protocol. It also provides functionality
 * for networking these messages via {@link module:zmq~Socket ZMQ sockets}.
 *
 */
module.exports = {
    Message: Message,
    Socket: Socket,

    /**
    * ZeroMQ bindings
    */
    zmq: zmq,
};

var DELIMITER = "<IDS|MSG>";

/**
 * Jupyter message
 * @class
 * @param          [properties]              Message properties
 * @param {Array}  [properties.idents]       ZMQ identities
 * @param {Object} [properties.header]
 * @param {Object} [properties.parent_header]
 * @param {Object} [properties.metadata]
 * @param {Object} [properties.content]
 * @param {Array}  [properties.buffers]        Unparsed message frames
 */
function Message(properties) {
    /**
     * ZMQ identities
     * @member {Array}
     */
    this.idents = properties && properties.idents || [];

    /**
     * @member {Object}
     */
    this.header = properties && properties.header || {};

    /**
     * @member {Object}
     */
    this.parent_header = properties && properties.parent_header || {};

    /**
     * @member {Object}
     */
    this.metadata = properties && properties.metadata || {};

    /**
     * @member {Object}
     */
    this.content = properties && properties.content || {};

    /**
     * Unparsed JMP message frames (any frames after content)
     * @member {Array}
     */
    this.buffers = properties && properties.buffers || [];
}

/**
 * Send a response over a given socket
 *
 * @param {module:zmq~Socket} socket Socket over which the response is sent
 * @param {String} messageType       Jupyter response message type
 * @param {Object} [content]         Jupyter response content
 * @param {Object} [metadata]        Jupyter response metadata
 * @param {String} [protocolVersion] Jupyter protocol version
 * @returns {module:jmp~Message} The response message sent over the given socket
 */
Message.prototype.respond = function (
    socket, messageType, content, metadata, protocolVersion
) {
    var response = new Message();

    response.idents = this.idents;

    response.header = {
        msg_id: uuid(),
        username: this.header.username,
        session: this.header.session,
        msg_type: messageType,
    };
    if (this.header && this.header.version) {
        response.header.version = this.header.version;
    }
    if (protocolVersion) {
        response.header.version = protocolVersion;
    }

    response.parent_header = this.header;
    response.content = content || {};
    response.metadata = metadata || {};

    socket.send(response);

    return response;
};

/**
 * Decode message received over a ZMQ socket
 *
 * @param {argsArray} messageFrames    argsArray of a message listener on a JMP
 *                                     socket
 * @param {String}    [scheme=sha256]  Hashing scheme
 * @param {String}    [key=""]         Hashing key
 * @returns {?module:jmp~Message} JMP message or `null` if failed to decode
 * @protected
 */
Message._decode = function (messageFrames, scheme, key) {
    // Workaround for Buffer.toString failure caused by exceeding the maximum
    // supported length in V8.
    //
    // See issue #4266 https://github.com/nodejs/node/issues/4266
    // and PR #4394 https://github.com/nodejs/node/pull/4394
    try {
        return _decode(messageFrames, scheme, key);
    } catch (err) {
        if (err.message.indexOf("toString") === -1) throw err;
    }

    return null;
};

function _decode(messageFrames, scheme, key) {
    scheme = scheme || "sha256";
    key = key || "";

    var i = 0;
    var idents = [];
    for (i = 0; i < messageFrames.length; i++) {
        var frame = messageFrames[i];
        if (frame.toString() === DELIMITER) {
            break;
        }
        idents.push(frame);
    }

    if (messageFrames.length - i < 5) {
        log("MESSAGE: DECODE: Not enough message frames", messageFrames);
        return null;
    }

    if (messageFrames[i].toString() !== DELIMITER) {
        log("MESSAGE: DECODE: Missing delimiter", messageFrames);
        return null;
    }

    if (key) {
        var obtainedSignature = messageFrames[i + 1].toString();

        var hmac = crypto.createHmac(scheme, key);
        hmac.update(messageFrames[i + 2]);
        hmac.update(messageFrames[i + 3]);
        hmac.update(messageFrames[i + 4]);
        hmac.update(messageFrames[i + 5]);
        var expectedSignature = hmac.digest("hex");

        if (expectedSignature !== obtainedSignature) {
            log(
                "MESSAGE: DECODE: Incorrect message signature:",
                "Obtained = " + obtainedSignature,
                "Expected = " + expectedSignature
            );
            return null;
        }
    }

    var message = new Message({
        idents: idents,
        header: toJSON(messageFrames[i + 2]),
        parent_header: toJSON(messageFrames[i + 3]),
        content: toJSON(messageFrames[i + 5]),
        metadata: toJSON(messageFrames[i + 4]),
        buffers: Array.prototype.slice.apply(messageFrames, [i + 6]),
    });

    return message;

    function toJSON(value) {
        return JSON.parse(value.toString());
    }
}

/**
 * Encode message for transfer over a ZMQ socket
 *
 * @param {String} [scheme=sha256] Hashing scheme
 * @param {String} [key=""]        Hashing key
 * @returns {Array} Encoded message
 * @protected
 */
Message.prototype._encode = function (scheme, key) {
    scheme = scheme || "sha256";
    key = key || "";

    var idents = this.idents;

    var header = JSON.stringify(this.header);
    var parent_header = JSON.stringify(this.parent_header);
    var metadata = JSON.stringify(this.metadata);
    var content = JSON.stringify(this.content);

    var signature = "";
    if (key) {
        var hmac = crypto.createHmac(scheme, key);
        var encoding = "utf8";
        hmac.update(new Buffer(header, encoding));
        hmac.update(new Buffer(parent_header, encoding));
        hmac.update(new Buffer(metadata, encoding));
        hmac.update(new Buffer(content, encoding));
        signature = hmac.digest("hex");
    }

    var response = idents.concat([ // idents
        DELIMITER, // delimiter
        signature, // HMAC signature
        header, // header
        parent_header, // parent header
        metadata, // metadata
        content, // content
    ]).concat(this.buffers);

    return response;
};


//class Socket extends zmq.Socket {
//constructor(socketType, scheme, key) {
//super(socketType);
//this._jmp = {
//scheme: scheme,
//key: key,
//_listeners: [],
//};
//}

//send(message, flags) {
//var p = Object.getPrototypeOf(Socket.prototype);

//if (message instanceof Message) {
//log("SOCKET: SEND:", message);

//return p.send.call(
//this, message._encode(this._jmp.scheme, this._jmp.key), flags
//);
//}

//return p.send.apply(this, arguments);
//}

//on(event, listener) {
//var p = Object.getPrototypeOf(Socket.prototype);

//if (event !== "message") {
//return p.on.apply(this, arguments);
//}

//var _listener = {
//unwrapped: listener,
//wrapped: (function () {
//var message = Message._decode(
//arguments, this._jmp.scheme, this._jmp.key
//);
//if (message) {
//listener(message);
//}
//}).bind(this),
//};
//this._jmp._listeners.push(_listener);
//return p.on.call(this, event, _listener.wrapped);
//}
//}

//exports.Socket = Socket;

/**
 * @class
 * @classdesc ZMQ socket that parses the Jupyter Messaging Protocol
 *
 * @param {String|Number} socketType ZMQ socket type
 * @param {String} [scheme="sha256"] Hashing scheme
 * @param {String} [key=""] Hashing key
 */
function Socket(socketType, scheme, key) {
    zmq.Socket.call(this, socketType);
    this._jmp = {
        scheme: scheme,
        key: key,
        _listeners: [],
    };
}

Socket.prototype = Object.create(zmq.Socket.prototype);
Socket.prototype.constructor = Socket;

/**
 * Send the given message.
 *
 * @param {module:jmp~Message|String|Buffer|Array} message
 * @param {Number} flags
 * @returns {module:jmp~Socket} `this` to allow chaining
 *
 */
Socket.prototype.send = function (message, flags) {
    var p = Object.getPrototypeOf(Socket.prototype);

    if (message instanceof Message) {
        log("SOCKET: SEND:", message);

        return p.send.call(
            this, message._encode(this._jmp.scheme, this._jmp.key), flags
        );
    }

    return p.send.apply(this, arguments);
};

/**
 * Add listener to the end of the listeners array for the specified event
 *
 * @param {String}   event
 * @param {Function} listener
 * @returns {module:jmp~Socket} `this` to allow chaining
 */
Socket.prototype.on = function (event, listener) {
    var p = Object.getPrototypeOf(Socket.prototype);

    if (event !== "message") {
        return p.on.apply(this, arguments);
    }

    var _listener = {
        unwrapped: listener,
        wrapped: (function () {
            var message = Message._decode(
                arguments, this._jmp.scheme, this._jmp.key
            );
            if (message) {
                listener(message);
            }
        }).bind(this),
    };
    this._jmp._listeners.push(_listener);
    return p.on.call(this, event, _listener.wrapped);
};

/**
 * Add listener to the end of the listeners array for the specified event
 *
 * @method module:jmp~Socket#addListener
 * @param {String}   event
 * @param {Function} listener
 * @returns {module:jmp~Socket} `this` to allow chaining
 */
Socket.prototype.addListener = Socket.prototype.on;

/**
 * Add a one-time listener to the end of the listeners array for the specified
 * event
 *
 * @param {String}   event
 * @param {Function} listener
 * @returns {module:jmp~Socket} `this` to allow chaining
 */
Socket.prototype.once = function (event, listener) {
    var p = Object.getPrototypeOf(Socket.prototype);

    if (event !== "message") {
        return p.once.apply(this, arguments);
    }

    var _listener = {
        unwrapped: listener,
        wrapped: (function () {
            var message = Message._decode(
                arguments, this._jmp.scheme, this._jmp.key
            );

            if (message) {
                try {
                    listener(message);
                } catch (error) {
                    Socket.prototype.removeListener.call(this, event, listener);
                    throw error;
                }
            }

            Socket.prototype.removeListener.call(this, event, listener);
        }).bind(this),
    };

    this._jmp._listeners.push(_listener);

    return p.on.call(this, event, _listener.wrapped);
};

/**
 * Remove listener from the listeners array for the specified event
 *
 * @param {String}   event
 * @param {Function} listener
 * @returns {module:jmp~Socket} `this` to allow chaining
 */
Socket.prototype.removeListener = function (event, listener) {
    var p = Object.getPrototypeOf(Socket.prototype);

    if (event !== "message") {
        return p.removeListener.apply(this, arguments);
    }

    var length = this._jmp._listeners.length;
    for (var i = 0; i < length; i++) {
        var _listener = this._jmp._listeners[i];
        if (_listener.unwrapped === listener) {
            this._jmp._listeners.splice(i, 1);
            return p.removeListener.call(this, event, _listener.wrapped);
        }
    }

    return p.removeListener.apply(this, arguments);
};

/**
 * Remove all listeners, or those for the specified event
 *
 * @param {String} [event]
 * @returns {module:jmp~Socket} `this` to allow chaining
 */
Socket.prototype.removeAllListeners = function (event) {
    var p = Object.getPrototypeOf(Socket.prototype);

    if (arguments.length === 0 || event === "message") {
        this._jmp._listeners.length = 0;
    }

    return p.removeAllListeners.apply(this, arguments);
};
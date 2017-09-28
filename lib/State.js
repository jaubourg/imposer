"use strict";

const STATE_PENDING = 0;
const STATE_RESOLVE_RECEIVED = 1;
const STATE_RESOLVE_DONE = 2;
const STATE_DONE = 3;

const message = [
    null,
    `resolution has been notified`,
    `resolution value has been received`,
    `promise is done`,
];

const BEFORE = Symbol( `before` );
const STATE = Symbol( `state` );

module.exports = class {
    constructor( resolve, reject ) {
        this.resolve = this.toDone( resolve );
        this.reject = this.toDone( reject );
        this[ STATE ] = STATE_PENDING;
    }
    [ BEFORE ]( level, func, advance ) {
        return arg => {
            if ( this[ STATE ] < level ) {
                if ( advance ) {
                    this[ STATE ] = level;
                }
                return func( arg );
            }
            throw new Error( `cannot be called after ${ message[ this[ STATE ] ] }` );
        };
    }
    beforeResolveDone( func ) {
        return this[ BEFORE ]( STATE_RESOLVE_DONE, func );
    }
    beforeDone( func ) {
        return this[ BEFORE ]( STATE_DONE, func );
    }
    toResolveReceived( func ) {
        return this[ BEFORE ]( STATE_RESOLVE_RECEIVED, func, true );
    }
    toResolveDone( func ) {
        return this[ BEFORE ]( STATE_RESOLVE_DONE, func, true );
    }
    toDone( func ) {
        return this[ BEFORE ]( STATE_DONE, func, true );
    }
};

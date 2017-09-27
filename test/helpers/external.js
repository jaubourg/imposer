/* this the adapter for aplus and es6 promise tests */

"use strict";

const assert = require( `assert` );
const Imposer = require( `../..` );

const NativePromise = Promise;

// as horrible as it is, those promise tests are atrocious when it comes
// to unhandled rejections so we just ignore them
process.on( `rejectionHandled`, () => undefined );
process.on( `unhandledRejection`, () => undefined );

module.exports = {
    // for promise/aplus tests
    "resolved": value => Imposer.resolve( value ),
    "rejected": e => Imposer.reject( e ),
    "deferred": () => {
        let resolve;
        let reject;
        const promise = new Imposer( ( ...args ) => ( [ resolve, reject ] = args ) );
        return {
            promise,
            reject,
            resolve,
        };
    },
    // for promise/es6 tests
    /* eslint-disable no-param-reassign */
    "defineGlobalPromise": globalObject => {
        // the assert module is not properly required
        // inside the tests (go figure)
        globalObject.assert = assert;
        globalObject.Promise = Imposer;
    },
    "removeGlobalPromise": globalObject => {
        globalObject.assert = undefined;
        globalObject.Promise = NativePromise;
    },
};

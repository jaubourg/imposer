"use strict";

const NativePromise = require( `./NativePromise` );

// a set of pending promises
module.exports = class extends Set {
    add( promise ) {
        if ( promise ) {
            const stored = promise.then(
                () => {
                    this.delete( stored );
                },
                reason => {
                    this.delete( stored );
                    throw reason;
                }
            );
            super.add( stored );
            return stored;
        }
        return undefined;
    }
    queue( action, clear ) {
        return ( ...args ) => {
            const returned = this.size ? NativePromise.all( this ).then( () => action( ...args ) ) : action( ...args );
            if ( returned instanceof NativePromise ) {
                if ( clear ) {
                    this.clear();
                }
                return this.add( returned );
            }
            return returned;
        };
    }
};

"use strict";

const NativePromise = require( `./NativePromise` );

// this is used by every static method to check they are properly called (Imposer.xxx)
const checkStaticContext = ( methodName, context, expected ) => {
    if ( context !== expected ) {
        throw new TypeError( `Imposer::${ methodName }(): wrong context` );
    }
};

// promotes a thenable into a promise of the type provided by the Constructor
// if not possible, calls promiseMaker to handle the situation
const toPromise = ( Constructor, target, promiseMaker ) => {
    if ( target ) {
        if ( target instanceof NativePromise ) {
            return target;
        }
        let thenMethod;
        try {
            thenMethod = target.then;
        } catch ( e ) {
            return Constructor.reject( e );
        }
        if ( typeof thenMethod === `function` ) {
            return new Constructor( ( ...handlers ) => thenMethod.apply( target, handlers ) );
        }
    }
    return promiseMaker( target );
};

// build a function that can chain in both sync and async situations
const chainFactory = ( Constructor, onError ) => ( item, action, notifier ) => {
    let actionHandled = false;
    const promise = toPromise( Constructor, item, value => {
        actionHandled = true;
        try {
            const returned = action( value );
            if ( returned instanceof NativePromise ) {
                return returned;
            }
        } catch ( reason ) {
            onError( reason );
            throw reason;
        }
        return undefined;
    } );
    if ( promise ) {
        return ( actionHandled ? promise : promise.then( action ) ).then( null, reason => {
            onError( reason );
            throw reason;
        }, notifier );
    }
    return undefined;
};

const noop = () => undefined;

// internal utility for promise => callback
const catchExceptions = ( fn, arg, catcher ) => {
    try {
        const returned = fn( arg );
        if ( returned instanceof NativePromise ) {
            return returned.then( noop, catcher );
        }
        return undefined;
    } catch ( e ) {
        return catcher( e );
    }
};

// blocks sync and async exceptions from bubbling up
const ignoreExceptions = fn => arg => {
    catchExceptions( fn, arg, noop );
};

// creates promises used internally as returned by notify and companions
const errorToArray = error => [ error ];
const toUser = ( Constructor, fn ) => arg => Constructor.resolve( catchExceptions( fn, arg, errorToArray ) );

// unwraps a promise created using the given Constructor
const unwrap = Constructor => {
    let handlers;
    const promise = new Constructor( ( ...args ) => ( handlers = args ) );
    return [ promise, ...handlers ];
};

module.exports = {
    chainFactory,
    checkStaticContext,
    ignoreExceptions,
    toPromise,
    toUser,
    unwrap,
};

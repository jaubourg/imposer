/* eslint-disable max-lines */

"use strict";

// by keeping a reference to the native promise implementation internally
// we make it possible to override it with Imposer later on
const NativePromise = Promise;

// utility to unwrap a promise and expose its handlers
const unwrap = Constructor => {
    let handlers;
    const promise = new Constructor( ( ...args ) => ( handlers = args ) );
    return [ promise, ...handlers ];
};

const CHECK_STATIC_CONTEXT = Symbol( `check static context` );
const RESOLVE = Symbol( `internal resolve` );
const SUBSCRIBERS = Symbol( `subscribers` );

const STATE_PENDING = 0;
const STATE_RESOLVE = 1;
const STATE_DONE = 2;

class Imposer extends NativePromise {

    constructor( action ) {
        if ( typeof action !== `function` ) {
            throw new TypeError( `Imposer: constructor parameter must be callable` );
        }
        // we extract the resolver and rejecter of the native promise
        let resolve;
        let reject;
        super( ( f, r ) => {
            resolve = f;
            reject = r;
        } );
        // we keep track of notification handlers
        this[ SUBSCRIBERS ] = [];
        // the current state ( 0 = pending, 1 = resolve pending, 2 = done )
        // rejecting passes us directly into done state
        let state = STATE_PENDING;
        const before = ( maxState, func ) => ( ...args ) => {
            if ( state < maxState ) {
                func( ...args );
            }
        };
        // for when resolve is pending, we'll wait for outbound notifications
        let pendingResolve;
        let pendingCount = 0;
        const unpending = before( STATE_DONE, () => {
            if ( !( pendingCount-- ) ) {
                state = STATE_DONE;
                resolve( pendingResolve );
            }
        } );
        const pending = ( resolveHandler, rejectHandler, notifyHandler ) => item => {
            pendingCount++;
            const promise = Imposer[ RESOLVE ]( item, value => {
                try {
                    resolveHandler( value );
                } catch ( e ) {
                    rejectHandler( e );
                }
                unpending();
            } );
            if ( promise ) {
                promise
                    .then( resolveHandler )
                    .then( null, rejectHandler, notifyHandler )
                    .then( unpending, unpending );
            }
        };
        // funcs
        const endWithReject = before( STATE_DONE, error => {
            state = STATE_DONE;
            pendingResolve = undefined;
            reject( error );
        } );
        const doNotify = before( STATE_DONE, value => {
            if ( value !== undefined ) {
                for ( const subscriber of this[ SUBSCRIBERS ] ) {
                    subscriber( value );
                }
            }
        } );
        const endWithResolve = before( STATE_RESOLVE, item => {
            state = STATE_RESOLVE;
            pendingCount--;
            pending( value => ( pendingResolve = value ), endWithReject, doNotify )( item );
        } );
        const notify = before( STATE_DONE, pending(
            doNotify,
            endWithReject,
            item => notify( item )
        ) );
        const notifyEach = before( STATE_DONE, collection => {
            if ( !collection || !collection[ Symbol.iterator ] ) {
                throw new TypeError( `Imposer notify.all(): iterable expected` );
            }
            for ( const notification of collection ) {
                notify( notification );
            }
        } );
        notify.each = pending(
            notifyEach,
            endWithReject,
            notify
        );
        // we call the constructor parameter and catch any eventual exception
        // so that we can report it as a rejection
        try {
            action(
                endWithResolve,
                endWithReject,
                notify
            );
        } catch ( e ) {
            endWithReject( e );
        }
    }

    // we make sure super methods return a native object
    static get [Symbol.species]() {
        return NativePromise;
    }

    then( _resolveHandler, _rejectHandler, notifyHandler ) {
        // first we create the promise and get its handlers
        const [ promise, resolve, reject, notify ] = unwrap( Imposer );
        // we'll wrap every handler so that we can check for level-1 infinite loops
        const notSelf = ( operationName, func ) => (
            // of course, we only handle functions
            typeof func === `function` ?
                value => {
                    const returned = func( value );
                    if ( returned === promise ) {
                        throw new TypeError( `Imposer.then(): ${ operationName } handler cannot return self` );
                    }
                    return returned;
                } :
                undefined
        );
        // if the notify handler is false, we mute notifications
        if ( notifyHandler !== false ) {
            let notifyHandlerAdded = false;
            // we create a utility so that we don't duplicate code whenever we add a notification handler
            const addNotifyHandler = _handler => {
                const handler = notSelf( `notify`, _handler );
                if ( handler ) {
                    notifyHandlerAdded = true;
                    this[ SUBSCRIBERS ].push( value => {
                        try {
                            notify( handler( value ) );
                        } catch ( e ) {
                            reject( e );
                        }
                    } );
                }
            };
            // if the notification handler is actually a collection, we add all its elements
            if ( notifyHandler && notifyHandler[ Symbol.iterator ] ) {
                for ( const handler of notifyHandler ) {
                    addNotifyHandler( handler );
                }
            // in any other case, we add it as is
            } else {
                addNotifyHandler( notifyHandler );
            }
            // if we added notify, just plumb together
            if ( !notifyHandlerAdded ) {
                addNotifyHandler( x => x );
            }
        }
        // we use the native then for resolve and reject handlers
        resolve( super.then( notSelf( `resolve`, _resolveHandler ), notSelf( `reject`, _rejectHandler ) ) );
        // we finally return the new promise we created
        return promise;
    }

    catch( rejectHandler ) {
        return this.then( null, rejectHandler );
    }

    pipe( notifyHandler ) {
        return this.then( null, null, notifyHandler );
    }

    // this is used by every static method to check they are properly called (Imposer.xxx)
    static [ CHECK_STATIC_CONTEXT ]( methodName, context ) {
        if ( context !== this ) {
            throw new TypeError( `Imposer::${ methodName }(): wrong context` );
        }
    }

    static all( items ) {
        Imposer[ CHECK_STATIC_CONTEXT ]( `all`, this );
        if ( !items || !items[ Symbol.iterator ] ) {
            return NativePromise.all( items );
        }
        return new Imposer( ( resolve, _, notify ) => resolve(
            NativePromise
                .all( Array.from( items ).map( item => {
                    if ( item instanceof Imposer ) {
                        return item.pipe( notify );
                    }
                    return Imposer[ RESOLVE ]( item, x => x );
                } ) )
        ) );
    }

    static create( creator ) {
        Imposer[ CHECK_STATIC_CONTEXT ]( `create`, this );
        if ( typeof creator !== `function` ) {
            throw new TypeError( `Imposer::create(): callable expected` );
        }
        return new Imposer(
            ( resolve, reject, notify ) => Imposer.resolve( creator( notify ) ).then( resolve, reject, notify )
        );
    }

    static of( item ) {
        Imposer[ CHECK_STATIC_CONTEXT ]( `of`, this );
        return new Imposer( ( resolve, reject, { each } ) =>
            NativePromise.resolve( item )
                .then( each )
                .then( resolve, reject )
        );
    }

    static race( items ) {
        Imposer[ CHECK_STATIC_CONTEXT ]( `race`, this );
        if ( !items || !items[ Symbol.iterator ] ) {
            return NativePromise.race( items );
        }
        return new Imposer( ( resolve, reject, notify ) => {
            for ( const item of items ) {
                const promise = Imposer[ RESOLVE ]( item, resolve );
                if ( promise ) {
                    promise.then( resolve, reject, notify );
                }
            }
        } );
    }

    static [ RESOLVE ]( target, promiseMaker ) {
        if ( target ) {
            if ( target instanceof NativePromise ) {
                return target;
            }
            let thenMethod;
            try {
                thenMethod = target.then;
            } catch ( e ) {
                return Imposer.reject( e );
            }
            if ( typeof thenMethod === `function` ) {
                return new Imposer( ( ...handlers ) => thenMethod.apply( target, handlers ) );
            }
        }
        return promiseMaker( target );
    }

    static resolve( target ) {
        Imposer[ CHECK_STATIC_CONTEXT ]( `resolve`, this );
        return this[ RESOLVE ]( target, value => new Imposer( resolve => resolve( value ) ) );
    }

    static reject( e ) {
        Imposer[ CHECK_STATIC_CONTEXT ]( `reject`, this );
        return new Imposer( ( _, reject ) => reject( e ) );
    }
}

module.exports = Imposer;

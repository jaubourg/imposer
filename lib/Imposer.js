"use strict";

const { chainFactory, checkStaticContext, ignoreExceptions, toPromise, toUser, unwrap } = require( `./utils` );
const NativePromise = require( `./NativePromise` );
const Pending = require( `./Pending` );
const State = require( `./State` );

const SUBSCRIBERS = Symbol( `subscribers` );

class Imposer extends NativePromise {

    // we make sure super methods return a native object
    static get [Symbol.species]() {
        return NativePromise;
    }

    static all( items ) {
        checkStaticContext( `all`, this, Imposer );
        if ( !items || !items[ Symbol.iterator ] ) {
            return NativePromise.all( items );
        }
        return new Imposer( ( resolve, _, notify ) => resolve(
            NativePromise
                .all( Array.from( items ).map( item => {
                    if ( item instanceof Imposer ) {
                        return item.pipe( notify );
                    }
                    return toPromise( Imposer, item, x => x );
                } ) )
        ) );
    }

    static create( creator ) {
        checkStaticContext( `create`, this, Imposer );
        if ( typeof creator !== `function` ) {
            throw new TypeError( `Imposer::create(): callable expected` );
        }
        return new Imposer(
            ( resolve, reject, notify ) => Imposer.resolve( creator( notify ) ).then( resolve, reject, notify )
        );
    }

    static from( item, inOrder = false ) {
        checkStaticContext( `from`, this, Imposer );
        return new Imposer( ( resolve, reject, { each, queue } ) =>
            NativePromise.resolve( item )
                .then( inOrder ? queue.each : each )
                .then( resolve, reject )
        );
    }

    static race( items ) {
        checkStaticContext( `race`, this, Imposer );
        if ( !items || !items[ Symbol.iterator ] ) {
            return NativePromise.race( items );
        }
        return new Imposer( ( resolve, reject, notify ) => {
            for ( const item of items ) {
                const promise = toPromise( Imposer, item, resolve );
                if ( promise ) {
                    promise.then( resolve, reject, notify );
                }
            }
        } );
    }

    static reject( e ) {
        checkStaticContext( `reject`, this, Imposer );
        return new Imposer( ( _, reject ) => reject( e ) );
    }

    static resolve( target ) {
        checkStaticContext( `resolve`, this, Imposer );
        return toPromise( Imposer, target, value => new Imposer( resolve => resolve( value ) ) );
    }

    constructor( executor ) {
        if ( typeof executor !== `function` ) {
            throw new TypeError( `Imposer::constructor(): parameter must be callable` );
        }
        // we create the state
        let state;
        super( ( resolve, reject ) => ( state = new State( resolve, reject ) ) );
        // we keep track of notification handlers
        this[ SUBSCRIBERS ] = [];
        // keep track of pending notifications
        const pending = new Pending();
        const endWithReject = ignoreExceptions( error => {
            pending.clear();
            state.reject( error );
        } );
        const chain = chainFactory( Imposer, endWithReject );
        const queueChain = pending.queue( chain, true );
        const track = ( action, notifier ) => item => pending.add( chain( item, action, notifier ) );
        const queueAndTrack = ( action, notifier ) => item => queueChain( item, action, notifier );
        // funcs
        const doNotify = state.beforeDone( value => {
            if ( value !== undefined ) {
                for ( const subscriber of this[ SUBSCRIBERS ] ) {
                    subscriber( value );
                }
            }
        } );
        const endWithResolve = ignoreExceptions( state.toResolveReceived( item => chain(
            item,
            state.toResolveDone( pending.queue( state.resolve ) ),
            doNotify
        ) ) );
        const notifyFactory = ( sub, doTrack, each ) => {
            const internal = state.beforeDone( doTrack( doNotify, doNotify ) );
            const main = toUser( Imposer, state.beforeResolveDone( internal ) );
            main.each = toUser( Imposer, state.beforeResolveDone( doTrack( collection => {
                if ( !collection || !collection[ Symbol.iterator ] ) {
                    throw new TypeError( `Imposer notify${ sub }.each(): iterable expected` );
                }
                return each( collection, internal );
            } ) ) );
            return main;
        };
        const notify = notifyFactory( ``, track, ( c, i ) => NativePromise.all( Array.from( c ).map( i ) ) );
        notify.queue = notifyFactory( `.queue`, queueAndTrack, collection => {
            const iterator = collection[ Symbol.iterator ]();
            const next = state.beforeDone( () => {
                const { done, value } = iterator.next();
                return !done && chain( value, v => {
                    doNotify( v );
                    return next();
                }, doNotify );
            } );
            return next();
        } );
        // we call the executor and catch any eventual exception
        // so that we can report it as a rejection
        try {
            executor( endWithResolve, endWithReject, notify );
        } catch ( e ) {
            endWithReject( e );
        }
    }

    pipe( notifyHandler ) {
        return this.then( null, null, notifyHandler );
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
}

module.exports = Imposer;

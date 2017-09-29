"use strict";

const { capture, Imposer, test, tests, wait } = require( `./helpers` );

tests(
    {
        "notifications": {
            "none": {
                "expect": [],
                "given": () => [],
            },
            "single value": {
                "expect": [ 1 ],
                "given": () => [ 1 ],
            },
            "two values": {
                "expect": [ 1, 4 ],
                "given": () => [ 1, 4 ],
            },
            "three values": {
                "expect": [ 1, 4, 7 ],
                "given": () => [ 1, 4, 7 ],
            },
            "four values": {
                "expect": [ 1, 4, 7, 10 ],
                "given": () => [ 1, 4, 7, 10 ],
            },
            "three values in a set": {
                "expect": [ 1, 4, 7 ],
                "given": () => new Set( [ 1, 4, 7 ] ),
            },
            "two values and one promise": {
                "expect": [ 1, 4, 7 ],
                "given": () => [ 1, 4, wait( 0 ).then( () => 7 ) ],
            },
            "one promise and two values": {
                "expect": [ 7, 1, 4 ],
                "given": () => [ wait( 0 ).then( () => 7 ), 1, 4 ],
            },
            "three promises": {
                "expect": [ 7, 4, 1 ],
                "given": () => [ wait( 150 ).then( () => 7 ), wait( 50 ).then( () => 4 ), wait( 0 ).then( () => 1 ) ],
            },
        },
        "deliver": {
            "one by one": ( queue, given ) => {
                for ( const item of given() ) {
                    queue( item );
                }
            },
            "in bulk": ( { each }, given ) => {
                each( given() );
            },
            "in bulk with a promise": ( { each }, given ) => {
                each( wait( 0 ).then( given ) );
            },
            "in bulk from Imposer.from from a promise": ( queue, given ) => {
                queue( Imposer.from( wait( 20 ).then( given ), true ) );
            },
        },
    },
    ( { deliver, "notifications": { expect, given } }, t ) => {
        t.plan( 2 );
        return capture(
            Imposer.create( async notify => {
                await wait( 0 );
                notify( wait( 10 ).then( () => `before` ) );
                deliver( notify.queue, given );
                notify.queue( `after` );
                return `done`;
            } )
        ).then(
            ( { notifications, value } ) => {
                t.deepEqual( notifications, [ `before`, ...expect, `after` ] );
                t.is( value, `done` );
            }
        );
    }
);

test( `resolve waits for pending`, t => {
    t.plan( 2 );
    return capture(
        new Imposer( ( resolve, _, { queue } ) => {
            queue( wait( 30 ).then( () => `pending` ) );
            resolve( `done` );
        } )
    ).then(
        ( { notifications, value } ) => {
            t.deepEqual( notifications, [ `pending` ] );
            t.is( value, `done` );
        }
    );
} );

test( `reject ignores pending`, t => {
    t.plan( 2 );
    return capture(
        Imposer.create( async ( { queue } ) => {
            queue( wait( 30 ).then( () => `pending` ) );
            await wait( 0 );
            throw `fail`;
        } )
    ).then(
        ( { notifications, reason } ) => {
            t.deepEqual( notifications, [] );
            t.is( reason, `fail` );
        }
    );
} );

tests(
    {
        "args": {
            "no argument": [],
            "a non-iterable": [ 78 ],
        },
    },
    ( { args }, t ) => {
        t.plan( 1 );
        return Imposer.create( ( { "queue": { each } } ) => each( ...args ) )
            .then( null, error => t.true( error instanceof TypeError ) );
    },
    `each rejects with`
);

test( `cannot notify with self`, t => {
    t.plan( 1 );
    const promise = Imposer.create( async ( { queue } ) => {
        await wait( 0 );
        queue( true );
    } ).pipe( () => promise );
    return promise.then( null, error => t.true( error instanceof TypeError ) );
} );

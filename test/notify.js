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
                "expect": [ 1, 4, 7 ],
                "given": () => [ wait( 0 ).then( () => 7 ), 1, 4 ],
            },
            "three promises": {
                "expect": [ 1, 4, 7 ],
                "given": () => [ wait( 150 ).then( () => 7 ), wait( 50 ).then( () => 4 ), wait( 0 ).then( () => 1 ) ],
            },
        },
        "deliver": {
            "one by one": ( notify, given ) => {
                for ( const item of given() ) {
                    notify( item );
                }
            },
            "in bulk": ( { each }, given ) => {
                each( given() );
            },
            "in bulk with a promise": ( { each }, given ) => {
                each( wait( 0 ).then( given ) );
            },
            "in bulk from Imposer.from": ( notify, given ) => {
                notify( Imposer.from( given() ) );
            },
            "in bulk from Imposer.from from a promise": ( notify, given ) => {
                notify( Imposer.from( wait( 0 ).then( given ) ) );
            },
        },
    },
    ( { deliver, "notifications": { expect, given } }, t ) => {
        t.plan( 2 );
        return capture(
            Imposer.create( async notify => {
                await wait( 0 );
                deliver( notify, given );
                return `done`;
            } )
        ).then(
            ( { notifications, value } ) => {
                t.deepEqual( notifications, expect );
                t.is( value, `done` );
            }
        );
    }
);

test( `resolve waits for pending`, t => {
    t.plan( 2 );
    return capture(
        new Imposer( ( resolve, _, notify ) => {
            notify( wait( 30 ).then( () => `pending` ) );
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
        Imposer.create( async notify => {
            notify( wait( 30 ).then( () => `pending` ) );
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
        return Imposer.create( ( { each } ) => each( ...args ) )
            .then( null, error => t.true( error instanceof TypeError ) );
    },
    `notify.each rejects with`
);

test( `cannot notify with self`, t => {
    t.plan( 1 );
    const promise = Imposer.create( async notify => {
        await wait( 0 );
        notify( true );
    } ).pipe( () => promise );
    return promise.then( null, error => t.true( error instanceof TypeError ) );
} );

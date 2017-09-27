"use strict";

const { capture, Imposer, tests, wait } = require( `./helpers` );

tests(
    {
        "list": {
            "empty array": {
                "expect": {
                    "notifications": [],
                    "value": [],
                },
                "given": () => [],
            },
            "literals": {
                "expect": {
                    "notifications": [],
                    "value": [ 1, true, `string`, {}, [] ],
                },
                "given": () => [ 1, true, `string`, {}, [] ],
            },
            "three imposers": {
                "expect": {
                    "notifications": [ 1, 2, 3, 4, 5, 6 ],
                    "value": [ 1, 2, 3 ],
                },
                "given": () => [
                    Imposer.create( async ( { each } ) => {
                        await wait( 10 );
                        each( [ 1, 2 ] );
                        return 1;
                    } ),
                    Imposer.create( async ( { each } ) => {
                        await wait( 20 );
                        each( [ 3, 4 ] );
                        return 2;
                    } ),
                    Imposer.create( async ( { each } ) => {
                        await wait( 30 );
                        each( [ 5, 6 ] );
                        return 3;
                    } ),
                ],
            },
            "exception in one imposer": {
                "expect": {
                    "notifications": [ 1, 2 ],
                    "reason": `fail`,
                },
                "given": () => [
                    Imposer.create( notify => {
                        notify( wait( 10 ).then( () => 1 ) );
                        notify( wait( 50 ).then( () => 1 ) );
                    } ),
                    Imposer.create( notify => {
                        notify( wait( 20 ).then( () => 2 ) );
                        notify( wait( 50 ).then( () => 2 ) );
                    } ),
                    Imposer.create( async () => {
                        await wait( 30 );
                        throw `fail`;
                    } ),
                ],
            },
        },
    },
    ( { "list": { expect, given } }, t ) => {
        t.plan( 1 );
        return capture( Imposer.all( given() ) ).then( obtained => t.deepEqual( obtained, expect ) );
    }
);

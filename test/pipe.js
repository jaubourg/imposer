"use strict";

const { Imposer, tests, wait } = require( `./helpers` );

tests(
    {
        "filter": {
            "undefined": {
                "expect": [ 1, 2, 3 ],
                "given": undefined,
            },
            "null": {
                "expect": [ 1, 2, 3 ],
                "given": null,
            },
            "a string": {
                "expect": [ 1, 2, 3 ],
                "given": `string`,
            },
            "false": {
                "expect": [],
                "given": false,
            },
            "a muting function": {
                "expect": [],
                "given": () => undefined,
            },
            "selective muting": {
                "expect": [ 1, 3 ],
                "given": number => ( number % 2 ? number : undefined ),
            },
            "a non-muting function": {
                "expect": [ null, null, null ],
                "given": () => null,
            },
            "asynchronously": {
                "expect": [ 1, 2, 3 ],
                "given": number => wait( 10 ).then( () => number ),
            },
            "with change": {
                "expect": [ 10, 20, 30 ],
                "given": number => number * 10,
            },
            "with an array of functions": {
                "expect": [ 1, 10, 2, 20, 3, 30 ],
                "given": [ false, number => number, `string`, number => number * 10, () => undefined ],
            },
        },
    },
    ( { "filter": { expect, given } }, t ) => {
        t.plan( 1 );
        const received = [];
        return Imposer.create( async ( { each } ) => {
            await wait( 0 );
            each( [ 1, 2, 3 ] );
        } )
            .pipe( given )
            .then(
                () => t.deepEqual( received, expect ),
                null,
                value => received.push( value )
            );
    }
);

tests(
    {
        "filter": {
            "a simple exception": {
                "expect": [],
                "given": () => {
                    throw `simple`;
                },
                "thrown": `simple`,
            },
            "an inside exception": {
                "expect": [ 1 ],
                "given": number => {
                    if ( number > 1 ) {
                        throw `inside`;
                    }
                    return number;
                },
                "thrown": `inside`,
            },
            "an exception in one of several": {
                "expect": [ 1, 1 ],
                "given": [
                    number => {
                        if ( number > 1 ) {
                            throw `inside of first`;
                        }
                        return number;
                    },
                    number => number,
                ],
                "thrown": `inside of first`,
            },
            "a rejection": {
                "expect": [ 1, 2 ],
                "given": number => wait( 10 ).then( () => {
                    if ( number > 2 ) {
                        throw `rejection`;
                    }
                    return number;
                } ),
                "thrown": `rejection`,
            },
            "an exception killing pending": {
                "expect": [ 1 ],
                "given": [
                    number => {
                        if ( number > 1 ) {
                            throw `exception with pending`;
                        }
                        return number;
                    },
                    number => wait( 0 ).then( () => number ),
                ],
                "thrown": `exception with pending`,
            },
        },
    },
    ( { "filter": { expect, given, thrown } }, t ) => {
        t.plan( 3 );
        const received = [];
        const receivedFull = [];
        const promise = Imposer.create( async ( { each } ) => {
            await wait( 0 );
            each( [ 1, 2, 3 ] );
        } );
        return promise
            .pipe( number => {
                receivedFull.push( number );
                return number;
            } )
            .pipe( given )
            .then(
                null,
                error => {
                    t.is( error, thrown );
                    return promise.then( () => {
                        t.deepEqual( receivedFull, [ 1, 2, 3 ] );
                        t.deepEqual( received, expect );
                    } );
                },
                value => received.push( value )
            );
    },
    `handling`
);

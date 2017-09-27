"use strict";

const { Imposer, tests } = require( `./helpers` );

tests(
    {
        "args": {
            "no argument": [],
            "a non-callable": [ 78 ],
        },
    },
    ( { args }, t ) => {
        t.plan( 1 );
        try {
            Imposer.create( ...args );
        } catch ( error ) {
            t.true( error instanceof TypeError );
        }
    },
    `throws with`
);

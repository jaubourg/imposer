"use strict";

const { Imposer, test } = require( `./helpers` );

test( `catch returns an imposer`, t => {
    t.plan( 1 );
    t.true( ( new Imposer( () => undefined ) ).catch() instanceof Imposer );
} );

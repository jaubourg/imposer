"use strict";

const Imposer = require( `../..` );
const test = require( `ava` );

function * eventualities( fields ) {
    const { length } = fields;
    if ( length ) {
        const [ [ name, rawValues ] ] = fields;
        const values =
            rawValues[ Symbol.iterator ] ?
                Array.from( rawValues ).map( value => [ `${ name }(${ value })`, value ] ) :
                Object.entries( rawValues );
        const next = fields.slice( 1 );
        for ( const [ label, value ] of values ) {
            const base = {
                [ name ]: {
                    label,
                    value,
                },
            };
            if ( next.length ) {
                for ( const object of eventualities( next ) ) {
                    yield Object.assign( {}, base, object );
                }
            } else {
                yield base;
            }
        }
    }
}

const list = array => array.join( ` ` );

const tests = ( fields, func, title ) => {
    for ( const eventuality of eventualities( Object.entries( fields ) ) ) {
        const id = list( Object.values( eventuality ).map( ( { label } ) => label ) );
        const data = {};
        Object.keys( eventuality ).forEach( key => ( data[ key ] = eventuality[ key ].value ) );
        test( `${ title ? `${ title } ` : `` }${ id }`, t => func( data, t ) );
    }
};

const wait = ( ms, ...args ) => new Imposer( resolve => setTimeout( resolve, ms, ...args ) );

const capture = imposer => {
    const notifications = [];
    return imposer.then(
        value => ( {
            notifications,
            value,
        } ),
        reason => ( {
            notifications,
            reason,
        } ),
        item => notifications.push( item )
    );
};

module.exports = {
    capture,
    Imposer,
    test,
    tests,
    wait,
};

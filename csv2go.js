/**
 * Created by WeSt on 5/22/2015.
 */

var csv = require( 'csv' );
var debug = require( 'debug' )( 'csv-to-go' );
var _ = require( 'lodash' );
var fs = require( 'fs' );



/**
 * Describes the default options for the outside facing methods
 * @type {{delimiter: string, quote: string, escape: string}}
 */
var defaultOptions = {
    delimiter: ',',
    quote: '"',
    escape: '"',
    skip: 0
};


/**
 * The default type used in schemas
 * @type {{type: string, column: string, range: number, apply: string, applyEach: string}}
 */
var defaultType = {
    type: '',
    column: 'auto', // according to the location in the schema
    range: 1,
    prepare: 'none',
    parse: 'auto',
    apply: 'none',
    aggregate: 'none'
};


/**
 * Describes all predefined functions that can be used in the prepare, apply and aggregate fields of
 * the type descriptions
 */
var predefinedFunction = {};
predefinedFunction['none'] = function( item ) {
    return item
};
predefinedFunction['trim'] = function( item ) {
    return item.trim()
};
predefinedFunction['concat'] = function( items ){
    return _.reduce( items, function(total, n) {
        return total + n;
    })
};
predefinedFunction['sum'] = function( items ){
    return _.sum( items );
};
predefinedFunction['max'] = function( items ){
    return _.max( items );
};
predefinedFunction['min'] = function( items ){
    return _.min( items );
};
predefinedFunction['avg'] = function( items ){
    return _.sum( items ) / items.length ;
};


/**
 * An array of custom types. Can be used by the user to extend the existing types
 */
var builtinTypes = [ 'Integer', 'Float', 'String', 'Date' ];
var registeredTypes = [];

register({
    type: 'Integer',
    parse: function( item ) {
        return parseInt( item );
    }
});
register({
    type: 'Float',
    parse: function( item ) {
        return parseFloat( item );
    }
});
register({
    type: 'String',
    parse: function( item ) {
        return item;
    }
});
register({
    type: 'Date',
    parse: function( item ) {
        return parseDate( item );
    }
});


/**
 * Adds the new type to the registered types
 * @param baseType The type from which to take the default values
 * @param type The type to add
 */
function register( type, baseType ){
    var fullType;
    if( baseType ){
        var origType = type.type;
        type.type = baseType;
        fullType = enrichTypeInstance( type );
        fullType.type = origType;
    } else {
        fullType = _.defaults( type, defaultType );
    }
    registeredTypes.push( fullType );
}


/**
 * Reads the file and returns its content
 * @param file The path to the file
 * @returns {*} The content of the file as string
 */
function readCsv( file ) {
    debug( 'Reading file content of ' + file );
    return fs.readFileSync( file ).toString();
}


/**
 * Invokes the csv module on the content
 * @param content The content to be parsed
 * @param options The options for the parser
 * @param cb The callback
 */
function parseCsv( content, options, cb ) {
    var csvOptions = {
        delimiter: options.delimiter,
        quote: options.quote,
        escape: options.escape
    };
    csv.parse( content, csvOptions, cb );
}


/**
 * Parses each line into an object conforming to the schema
 * @param lines The lines of the CSV to be parsed
 * @param schema The schema
 * @param options The options
 * @returns {*} A list of objects
 */
function materialize( lines, schema, options ){
    var keys = _.keys( schema );
    var items = [];
    var skipCount = options.skip;
    _.forEach( lines, function( line ){
        if( skipCount > 0 ){
            skipCount--;
            return;
        }
        if( ignore( line, options ) ){
            return;
        }

        var item = {};
        var index = 0;
        _.forEach( keys, function( key ){
            var type = schema[key];
            try {
                var fullType = getFullTypeInstance( type );
                resolveAutoColumn( fullType, index );

                var result = convertItem( fullType, line );
                writeTo( item, key, result );
            } catch( e ) {
                throw e + ". On property " + key
            }
            index += fullType.range;
        });
        items.push( item );
    });
    return excludeItems( items, options );
}


/**
 * Checks whether a line should be ignored from parsing. A user can specify an ignore-function(). If this
 * function returns true, the line will be skipped.
 * @param segments The segments of the line
 * @param options The options
 */
function ignore( segments, options ){
    if( ! options.ignore ){
        return false; // no line will be ignored by default
    }
    if( ! _.isFunction( options.ignore ) ){
        throw 'Invalid option: ignore is not a function';
    }
    return options.ignore( segments );
}

/**
 * Writes the value to the target object, creating intermediate objects if necessary
 * @param target The target object
 * @param path The dot-separated list of properties (e.g. address.city.postalcode)
 * @param value The value to write to the property
 */
function writeTo( target, path, value ){
    if( path.indexOf( '.' ) !== -1 ){
        var dot = path.indexOf( '.' );
        var prop = path.substring( 0, dot );
        var remainder = path.substring( dot + 1 );

        if( dot === 0 ){
            throw "Illegal property name";
        }
        if( ! target[ prop ] ){
            target[ prop ] = {};
        }
        return writeTo( target[ prop ], remainder, value );
    }
    return target[path] = value;
}


/**
 * Sets the column index (only required if the type has 'auto' set for column index)
 * @param fullType The type
 * @param index The index
 */
function resolveAutoColumn( fullType, index ){
    // resolve column for 'auto'
    if( _.isString( fullType.column ) ){
        if( fullType.column === 'auto' ){
            fullType.column = index;
        } else {
            throw 'Invalid value for column';
        }
    }
}


/**
 *
 * @param items Excludes all result items that do not fulfill the predicate
 * @param options The options holding the predicate
 * @returns {*} A list of all items fulfilling the predicate or all items if there is no predicate
 */
function excludeItems( items, options ){
    if( ! options.exclude ){
        return items;
    }
    if( ! _.isFunction( options.exclude ) ){
        throw 'Invalid option: exclude is not a function';
    }
    return _.filter( items, function( item ) {
		return ! options.exclude( item );
	});
}


/**
 * Converts one or more line segments into an item of the given type
 * @param type The type of the item
 * @param line The line (array of segments)
 * @returns {*} An item of the given type
 */
function convertItem( type, line ){
    var values = [];
    var items = extractItems( line, type );

    var index = 0; // index inside of this type (required if it spans multiple columns)
    _.forEach( items, function( item ){
        var preparedItem = prepareItem( item, type, index );
        var value = parseItem( type, preparedItem, index );
        value = applyItem( value, type, index );
        values.push( value );
        index++;
    });

    return aggregate( values, type );
}


/**
 * Prepares an item for parsing
 * @param item The item to prepare
 * @param type The type holding the prepare function
 * @param index The type-internal index
 * @returns {*} The prepared item
 */
function prepareItem( item, type, index ) {
    if( type.prepare && type.prepare !== 'none' ){
        var prepare = resolveFunction( type.prepare );
        return prepare( item, index );
    } else {
        return item;
    }
}


/**
 * Converts the already parsed item using the apply function
 * @param item The item to change
 * @param type The type holding the apply function
 * @param index The type-internal index
 * @returns {*} The changed item
 */
function applyItem( item, type, index ){
    if( type.apply && type.apply !== 'none' ){
        var apply = resolveFunction( type.apply );
        return apply( item, index );
    } else {
        return item;
    }
}


/**
 * Aggregates several items to yield one result on a multi-column type
 * @param items The items
 * @param type The type
 * @returns {*} An item representing the aggregated values
 */
function aggregate( items, type ){
    if( type.aggregate && type.aggregate !== 'none' ){
        var aggregate = resolveFunction( type.aggregate );
        return aggregate( items );
    } else {
        if( type.range === 1 ) {
            return _.first( items );
        } else {
            return items;
        }
    }
}


/**
 * Gets the full type for a schema entry
 * @param type A simple type or incomplete full type
 * @returns {*} A full type
 */
function getFullTypeInstance( type ){
    if ( _.isString( type ) ) {
        return createTypeInstance( type );
    } else {
        return enrichTypeInstance( type );
    }
}


/**
 * Creates an instance of the type
 * @param type The type
 * @returns {*} The type
 */
function createTypeInstance( type ){
    var registeredType = _.find( registeredTypes, { type: type } );
    if( ! registeredType ){
        throw 'Unknown type ' + type
    }
    return _.clone( registeredType );
}


/**
 * Enriches the type with the default options for it
 * @param type The type
 * @returns {*} The type
 */
function enrichTypeInstance( type ){
    var registeredType = _.find( registeredTypes, { type: type.type } );
    if( ! registeredType ){
        throw 'Unknown type ' + type
    }
    var fullType = _.clone( type );
    return _.defaults( fullType, registeredType );
}


/**
 * Extracts the segments from the line
 * @param line The line holding the segments
 * @param fullType The type specifying which range to take
 * @returns {*} An array of segments
 */
function extractItems( line, fullType ){
    var start = fullType.column;
    var end = start + fullType.range;

    if( start >= line.length ){
        throw 'Input out of range'
    }
    return _.slice( line, start, end );
}


/**
 * Resolves a function by looking up the predefined functions or returning the parameter directly, if it is already
 * a function
 * @param f The function or the name of a predefined function
 * @returns {*} A function
 */
function resolveFunction( f ){
    var func = f;
    if ( _.isString( f ) ) {
        func = predefinedFunction[ f ];
        if( func ){
            return func;
        }
        throw 'Unknown function "' + f + '"';
    }
    return func; // this is already a function
}


/**
 * Parses a segment to the given type
 * @param fullType The type
 * @param value The segment
 * @param index The line-specific index of the segment
 * @returns {*} The value conforming to the given type
 */
function parseItem( fullType, value, index ){
    if( ! fullType.parse || fullType.parse === 'none' ) {
        throw 'Invalid value for parse'
    }
    if( !_.isFunction( fullType.parse ) ){
        throw 'Invalid value for parse'
    }

    var parse = fullType.parse;
    return parse( value, index );
}


/**
 * Parses the input string to a date
 * @param input The input string holding a date value
 * @returns {Date} A date value
 */
function parseDate(input) {
    var parts = input.split('-');
    if( parts.length < 2 ){
        throw 'Invalid date format. Expected: yyyy-mm-dd'
    }
    return new Date(parts[0], parts[1] - 1, parts[2]);
}


/**
 * Parses the CSV file and returns a list of objects conforming to the schema
 * @param path The path to the file
 * @param schema The schema describing the resulting objects
 * @param options The options
 * @param cb The callback called with the result
 */
function parseFile( path, schema, options, cb ){
    if( ! path ){
        throw 'No path found for "' + path + '"'
    }
    var content = readCsv( path );
    parse( content, schema, options, cb );
}


/**
 * Parses the content and returns a list of objects conforming to the schema
 * @param content The content to the be parsed
 * @param schema The schema describing the resulting objects
 * @param options The options
 * @param cb The callback called with the result
 */
function parse( content, schema, options, cb ){
    if( ! content ){
        throw 'No content found'
    }
    if( ! options ){
        options = _.clone( defaultOptions );
    }
    if( ! schema ){
        debug( 'No schema, auto-detection of schema required' );
    }

    // take over missing options
    _.defaults( options, defaultOptions );

    // parse CSV and convert it to objects
    parseCsv( content, options, function( err, lines ){
        if( err ) {
            return cb( err );
        }
        var result;
        var error;
        try {
            result = materialize( lines, schema, options );
        } catch( e ){
            error = e;
        }
        cb( error, result );
    });
}



/**
 * Removes a given type from the registered types
 */
function unregister( type ){
    if( builtinTypes.indexOf( type ) !== -1 ){
        throw 'Cannot remove built-in type ' + type;
    }

    var index = _.findIndex( registeredTypes, function( regType ) {
        return regType.type === type;
    });
    if( index !== -1 ){
        registeredTypes.splice(index, 1);
    }
}


// export
module.exports = {
    parse: parse,
    parseFile: parseFile,
    register: register,
    unregister: unregister
};


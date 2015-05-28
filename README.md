csv2go
=========

A small library for parsing CSV files to JavaScript objects. A user can pass in a schema describing the relation between
the csv columns and the expected objects and _csv2go_ will create an object conforming to the schema for each line
of the input.

_csv2go_ supports
* mapping csv columns to object properties
* mapping csv columns to nested object properties
* aggregating several columns to one object property
* customizing how a column is parsed to a value (e.g. for special date formats or float representations)
* skipping and filtering certain lines in the csv
* customizing csv parser options (delimiter, quotes, etc.)

## Installation

    npm install csv2go --save

## Usage

csv2go can parse files or strings to objects by passing a schema to it. For this, it offers two main entry points:

```javascript
/**
 * Parses the content and returns a list of objects conforming to the schema
 * @param content The content to the be parsed
 * @param schema The schema describing the resulting objects
 * @param options The options
 * @param cb The callback called with the result
 */
parse( content, schema, options, cb );


/**
 * Parses the CSV file and returns a list of objects conforming to the schema
 * @param path The path to the file
 * @param schema The schema describing the resulting objects
 * @param options The options
 * @param cb The callback called with the result
 */
parseFile( path, schema, options, cb );
```

A schema describes the way the columns in the csv are mapped to the object properties. The easiest case to call _csv2go_ 
is to pass a simple schema, which only consists of a name and type for each property.

```javascript
var schema = {
    name: 'String', // takes column 0 from csv
    age: 'Integer'  // takes column 1 from csv
};
var content = 'Max, 25';

csv2go.parse( content, schema, null, function(err, result){
    // result is an array of objects, one for each line of the csv
    console.log( result[0].name == 'Max' ); // true
    console.log( result[0].age == 25 ); // true
});
```
    
### Customizing CSV parser

_csv2go_ uses the powerful **csv npm module**. You change parser options by passing it as parameter to the _csv2go.parse()_
and _csv2go.parseFile()_ call:

```javascript
var defaultOptions = {
    delimiter: ',',
    quote: '"',
    escape: '"',
    skip: 0 // number of rows skipped at the beginning (e.g. for header rows)
};
csv2go.parse( content, schema, defaultOptions, function(err, result) { //... } );
```
    
### Aggregating CSV columns

_csv2go_ can also be used to aggregate several csv columns to one object value. For this, we can pass an object as type:

```javascript
var schema = {
    name: 'String', // takes column 0 from csv
    salary: { // takes column 1-4 from csv
        type: 'Integer',
        range: 4,
        aggregate: 'sum'
    }
};
var content = 'Max,2,4,1,8';
      
csv2go.parse( content, schema, null, function(err, result){
    // result is an array of objects, one for each line of the csv
    console.log( result[0].name == 'Max' ); // true
    console.log( result[0].salary == 15 ); // true
});
```
    
Built-in aggregation functions are __sum__, __avg__, __min__ and __max__ for integers and floats and __concat__ for strings.
   
### Creating nested objects
```javascript
var schema = {
    'person.name': 'String', // takes column 0 from csv
    'person.age': 'Integer'  // takes column 1 from csv
    total: 'Integer'  // takes column 2 from csv
};
var content = 'Max, 25, 123';

csv2go.parse( content, schema, null, function(err, result){
    // result is an array of objects, one for each line of the csv
    console.log( result[0].person.name == 'Max' ); // true
    console.log( result[0].person.age == 25 ); // true
    console.log( result[0].total == 123 ); // true
});
```
      
### Ignoring certain rows (before parsing them)
```javascript
var schema = {
    text: 'String',
    num: 'Integer'
};
content = 'abc,5\ndef,0\nghi,2';
var options = {
    ignore: function( segments ){
        // can also use segments.length to filter too short rows
        return segments[1] == "0";
    }
};

csv2go.parse( content, schema, options, function(err, result){
    // result has length 2
	// the row 'def,0' was ignored
});
```

### Excluding certain objects (after parsing)

```javascript
var schema = {
    text: 'String',
    num: 'Integer'
};
content = 'abc,5\ndef,0\nghi,2';
var options = {
    exclude: function( item ){
        return item.num < 1;
    }
};

csv2go.parse( content, schema, options, function(err, result){
    // result has length 2
	// item 'def,0' was filtered out
});
```


## Advanced Usage
We have already seen the use of basic schemas, aggregation and options. However, _csv2go_ provides several other, powerful functions.
 
### Parsing certain columns and ignoring the rest

```javascript
var schema = {
    name: {
        type: 'String',
        column: 1,
    },
    age: {
        type: 'Integer',
        column: 5,
    }
};
var content = 'i,Max,i,i,i,25,i';

csv2go.parse( content, schema, null, function(err, result){
    // result is an array of objects, one for each line of the csv
    console.log( result[0].name == 'Max' ); // true
    console.log( result[0].age == 25 ); // true
});
```
    
### Customizing value conversion

```javascript
var schema = {
    name: 'String',
    value: {
        type: 'Float',
        parse: function( item ){
            return parseFloat( item.substring(0,5) ); // parse the substring, e.g. '123.4' instead of '123.4_test'
        }
    }
};
content = 'Max,123.4_test';

csv2go.parse( content, schema, null, function(err, result){
    // result is an array of objects, one for each line of the csv
    console.log( result[0].name == 'Max' ); // true
    console.log( result[0].age == 123.4 ); // true
});
```
    
### prepare(), parse() and apply()

Parsing a column can be customized in three steps:
* _prepare()_ takes the raw column value. Can be used to change the value before parsing it
* _parse()_ takes the value from prepare() and parses it
* _apply()_ can be used to change the resulting value

A user can overwrite any one or all of these function for a given type.

```javascript
var schema = {
    value: {
        type: 'Integer',
        prepare: function( item ){
            return item + '0'; // append '0' to each input (which is still a string here)
        },
        parse: function( item, index ){
            return parseInt( item ) * 2;
        },
        apply: function( item ){
            return parseInt( item ) - 1;
        }
    }        };
var content = '1\n3\n10';

csv2go.parse( content, schema, null, function(err, result){
    console.log( result[0].value == 19 ); // int('1' + '0') * 2 - 1
    console.log( result[1].value == 59 ); // int('3' + '0') * 2 - 1
    console.log( result[2].value == 199 ); // int('10' + '0') * 2 - 1
});
```
       
### Creating new types
If you have to heavily customize an existing type or need a customization on various places, you can introduce a 
new type instead.

```javascript
var moneyType = {
    type: 'Money',
    apply: function( item ){
        return parseFloat(item.toFixed(2)); // as usual for money, round to two places
    }
};
csv2go.register( moneyType, 'Float' ); // register money to derive from 'Float'. 'Money' can be used anywhere in the app now

var schema = {
    x: 'Money',
    y: 'Integer',
    z: 'Money'
};
content = '123.4478,333,345.6745';

csv2go.parse( content, schema, null, function(err, result){
    console.log( result[0].x == 123.45 ); // all properties of type 'Money' have only 2 decimal places now
    console.log( result[0].y == 333 );
    console.log( result[0].z == 345.67 );
});
```
    
## Tests

    npm test

## Contributing

In lieu of a formal style guide, take care to maintain the existing coding style.
Add unit tests for any new or changed functionality. Lint and test your code.

## Release History

* 0.1.0 Initial release
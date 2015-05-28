/**
 * Created by WeghofeS on 5/22/2015.
 */



var assert = require('chai').assert;
var csv2go = require('../csv2go');
var _ = require('lodash');


describe('csv2go', function(){
    var path;
    var content;
    var wrapper;
    var schema;
    var options;


    describe('keys', function(){

        it('should be ordered in the way they are declared', function(){
            var schema = {
                a: 'String',
                c: 'Integer',
                d: 'Integer',
                b: 'Integer'
            };
            var keys = _.keys( schema );
            assert.deepEqual( keys, ['a', 'c', 'd', 'b'] );
        });

        it('should order numeric keys first', function(){
            var schema = {
                a: 'String',
                c: 'Integer',
                b: 'Integer',
                1: 'Integer'
            };
            var keys = _.keys( schema );
            assert.deepEqual( keys, [ '1', 'a', 'c', 'b'] );
        });

        it('should order alphanumeric keys in the way they are declared', function(){
            var schema = {
                a: 'String',
                c: 'Integer',
                'c2': 'Integer',
                b: 'Integer',
                '1a': 'Integer'
            };
            var keys = _.keys( schema );
            assert.deepEqual( keys, [ 'a', 'c', 'c2', 'b', '1a'] );
        });

    });


    describe('parse()', function(){

        /*********************************
         * Input validation tests
         *********************************/

        it('should throw an exception on missing path', function(){
            wrapper = function() {
                csv2go.parseFile( null );
            };
            assert.throws( wrapper, 'No path found for "null"' );
        });

        it('should not fail on missing separator', function( done ){
            schema = {
                sum: {
                    type: 'Integer',
                    range: 2,
                    aggregate: 'sum'
                }
            };
            content = '0';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].sum, 0 );
                done();
            });
        });


        /*********************************
         * General option tests
         * (exclude, delimiter, etc.)
         *********************************/

        it('should take default values for options', function( done ){
            schema = {
                text: 'String',
                num: 'Integer'
            };
            content = 'abc,2';
            options = { };

            csv2go.parse( content, schema, options, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].text, 'abc' );
                assert.strictEqual( result[0].num, 2 );
                done();
            });
        });

        it('should use exclude to filter results', function( done ){
            schema = {
                text: 'String',
                num: 'Integer'
            };
            content = 'abc,5\ndef,0\nghi,2';
            options = {
                exclude: function( item ){
                    return item.num < 1;
                }
            };

            csv2go.parse( content, schema, options, function(err, result){
                assert.lengthOf( result, 2 );
                assert.strictEqual( result[0].text, 'abc' );
                assert.strictEqual( result[0].num, 5 );
                assert.strictEqual( result[1].text, 'ghi' );
                assert.strictEqual( result[1].num, 2 );
                done();
            });
        });

        it('should use exclude to filter results (and even filter out everything)', function( done ){
            schema = {
                text: 'String',
                num: 'Integer'
            };
            content = 'abc,5\ndef,0\nghi,2';
            options = {
                exclude: function( item ){
                    return item.num < 10;
                }
            };

            csv2go.parse( content, schema, options, function(err, result){
                assert.lengthOf( result, 0 );
                done();
            });
        });


        /* skip */

        it('should take the skip option to ignore the first X rows', function( done ){
            schema = {
                text: 'String',
                num: 'Integer'
            };
            content = 'abc,5\ndef,0\nghi,2';
            options = {
                skip: 2
            };

            csv2go.parse( content, schema, options, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].text, 'ghi' );
                assert.strictEqual( result[0].num, 2 );
                done();
            });
        });

        it('should take the skip option to ignore the first X rows', function( done ){
            schema = {
                text: 'String',
                num: 'Integer'
            };
            content = 'abc,5\ndef,0\nghi,2';
            options = {
                skip: 5
            };

            csv2go.parse( content, schema, options, function(err, result){
                assert.lengthOf( result, 0 );
                done();
            });
        });


        /* delimiter */

        it('should use delimiter to split input', function( done ){
            schema = {
                text: 'String',
                num: 'Integer'
            };
            content = 'abc;5\ndef;0\nghi;2';
            options = {
                delimiter: ';'
            };

            csv2go.parse( content, schema, options, function(err, result){
                assert.lengthOf( result, 3 );
                done();
            });
        });

        it('should use delimiter to split input', function( done ){
            schema = {
                text: 'String'
            };
            content = 'abc;5\ndef;0\nghi;2';
            options = {
                delimiter: '|'
            };

            csv2go.parse( content, schema, options, function(err, result){
                assert.lengthOf( result, 3 );
                assert.equal( result[0].text, 'abc;5' );
                assert.equal( result[1].text, 'def;0' );
                assert.equal( result[2].text, 'ghi;2' );
                done();
            });
        });

        it('should ignore delimiters in strings', function( done ){
            schema = {
                first: 'String',
                sec: 'String',
                third: 'String'
            };
            content = '"this;should";be;ignored';
            options = {
                delimiter: ';'
            };

            csv2go.parse( content, schema, options, function(err, result){
                assert.lengthOf( result, 1 );
                assert.equal( result[0].first, 'this;should' );
                assert.equal( result[0].sec, 'be' );
                assert.equal( result[0].third, 'ignored' );
                done();
            });
        });

        it('should consider escaped string delimiters', function( done ){
            schema = {
                first: 'String',
                sec: 'String',
                third: 'String'
            };
            content = "'this;should';be;ignored";
            options = {
                delimiter: ';',
                quote: '"'
            };

            csv2go.parse( content, schema, options, function(err, result){
                assert.lengthOf( result, 1 );
                assert.equal( result[0].first, '\'this' );
                assert.equal( result[0].sec, 'should\'' );
                assert.equal( result[0].third, 'be' );
                done();
            });
        });

        it('should consider the quote options for determining strings', function( done ){
            schema = {
                first: 'String',
                sec: 'String',
                third: 'String'
            };
            content = "#this;should#;be;ignored";
            options = {
                delimiter: ';',
                quote: '#'
            };

            csv2go.parse( content, schema, options, function(err, result){
                assert.lengthOf( result, 1 );
                assert.equal( result[0].first, 'this;should' );
                assert.equal( result[0].sec, 'be' );
                assert.equal( result[0].third, 'ignored' );
                done();
            });
        });

        it('should throw an exception when a property cannot be filled due to missing input', function( done ){
            schema = {
                text: 'String',
                num: 'Integer'
            };
            content = 'abc;5\ndef;0\nghi;2';
            options = {
                delimiter: '|'
            };

            csv2go.parse( content, schema, options, function(err){
                assert.equal( err, 'Input out of range. On property num' );
                done();
            });
        });


        /* object creation in type name */

        it('should create nested objects when the type name contains a property chain', function( done ){
            schema = {
                'customer.firstname': 'String',
                'customer.lastname': 'String',
                age: 'Integer'
            };
            content = 'Lassmiranda,Dennsiewillja,27';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.isDefined( result[0].customer );
                assert.equal( result[0].customer.firstname, 'Lassmiranda' );
                assert.equal( result[0].customer.lastname, 'Dennsiewillja' );
                assert.equal( result[0].age, 27 );
                done();
            });
        });

        it('should create nested objects when the type name contains a property chain and use apply to aggregate', function( done ){
            schema = {
                'customer.firstname': {
                    type: 'String',
                    range: 11,
                    aggregate: 'concat'
                },
                'customer.lastname': 'String',
                age: 'Integer'
            };
            content = 'L,a,s,s,m,i,r,a,n,d,a,Dennsiewillja,27';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.isDefined( result[0].customer );
                assert.equal( result[0].customer.firstname, 'Lassmiranda' );
                assert.equal( result[0].customer.lastname, 'Dennsiewillja' );
                assert.equal( result[0].age, 27 );
                done();
            });
        });


        it('should throw an error on invalid property names', function( done ){
            schema = {
                'customer..firstname': 'String',
                'customer.lastname': 'String',
                age: 'Integer'
            };
            content = 'L,a,s,s,m,i,r,a,n,d,a,Dennsiewillja,27';

            csv2go.parse( content, schema, null, function(err, result){
                assert.equal(err, 'Illegal property name. On property customer..firstname');
                done();
            });
        });

        /*********************************
         * General type tests
         * (apply, aggregate, column, etc.)
         *********************************/

        it('should throw an exception on unknown type', function( done ){
            schema = {
                text: 'String',
                num: 'Int' // correct name: Integer
            };
            content = 'abc,5';

            csv2go.parse( content, schema, null, function(err){
                assert.equal( err, 'Unknown type Int. On property num' );
                done();
            });
        });

        it('should call apply on each item of a type', function( done ){
            schema = {
                text: {
                    type: 'String',
                    range: 2,
                    apply: function( item ){
                        return item + "_"
                    },
                    aggregate: 'concat'
                }
            };
            content = 'abc,def';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].text, 'abc_def_' );
                done();
            });
        });

        it('should not call apply if it is "none"', function( done ){
            schema = {
                text: {
                    type: 'String',
                    range: 2,
                    apply: "none",
                    aggregate: 'concat'
                }
            };
            content = 'abc,def';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].text, 'abcdef' );
                done();
            });
        });

        it('should not call apply if it is "none"', function( done ){
            schema = {
                text: {
                    type: 'String',
                    range: 2,
                    apply: "none",
                    aggregate: 'concat'
                }
            };
            content = 'abc,def';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].text, 'abcdef' );
                done();
            });
        });

        it('should return an error on wrong apply string', function( done ){
            schema = {
                text: {
                    type: 'String',
                    range: 2,
                    apply: "does-not-exist",
                    aggregate: 'concat'
                }
            };
            content = 'abc,def';

            csv2go.parse( content, schema, null, function( err ){
                assert.equal( err, 'Unknown function "does-not-exist". On property text' );
                done();
            });
        });

        it('should return an error on wrong aggregate string', function( done ){
            schema = {
                text: {
                    type: 'String',
                    range: 2,
                    apply: 'none',
                    aggregate: 'does-not-exist-either'
                }
            };
            content = 'abc,def';

            csv2go.parse( content, schema, null, function( err ){
                assert.equal( err, 'Unknown function "does-not-exist-either". On property text');
                done();
            });
        });


        /* prepare */

        it('should use the prepare function if specified', function( done ){
            schema = {
                x: {
                    type: 'String',
                    range: 4,
                    prepare: function( item ){
                        return item + '_';
                    },
                    aggregate: 'concat'
                }
            };
            content = 'this,is,a,test';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].x, 'this_is_a_test_' );
                done();
            });
        });

        it('should call the prepare function with an index parameter, starting at 0', function( done ){
            schema = {
                x: {
                    type: 'String',
                    range: 4,
                    prepare: function( item, index ){
                        return item + '_' + index + '_';
                    },
                    aggregate: 'concat'
                }
            };
            content = 'this,is,a,test';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].x, 'this_0_is_1_a_2_test_3_' );
                done();
            });
        });

        /* parse function */

        it('should use the parse function when specified', function( done ){
            schema = {
                x: {
                    type: 'Float',
                    parse: function( item ){
                        return parseFloat( item.substring(0,5) );
                    }
                }
            };
            content = '123.4_test';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].x, 123.4 );
                done();
            });
        });

        it('should use the parse and aggregate in conjunction, if both are specified', function( done ){
            schema = {
                x: {
                    type: 'Float',
                    range: 2,
                    parse: function( item, index ){
                        if( index === 0 ){
                            return parseFloat( item.substring(0,5) );
                        }
                        return parseInt( item );
                    },
                    aggregate: function( items ){
                        return items[0] * items[1];
                    }
                }
            };
            content = '123.4_test,17';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].x, 2097.8 );
                done();
            });
        });


        /* column */

        it('should use the column property to specify which segment to take', function( done ){
            schema = {
                text: {
                    type: 'String',
                    column: 2
                },
                text2: {
                    type: 'String',
                    column: 5
                }
            };
            content = 'a,b,c,d,e,f,g';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.deepEqual( result[0].text, 'c' );
                assert.deepEqual( result[0].text2, 'f' );
                done();
            });
        });

        it('should throw and exception on invalid column content', function( done ){
            schema = {
                text: {
                    type: 'String',
                    column: 'this-is-an-invalid-value'
                }
            };
            content = 'a,b,c,d,e,f,g';

            csv2go.parse( content, schema, null, function( err ){
                assert.isNotNull( err );
                assert.equal( err, 'Invalid value for column. On property text' );
                done();
            });
        });

        it('should throw and exception on column value to high', function( done ){
            schema = {
                text: {
                    type: 'String',
                    column: 10
                }
            };
            content = 'a,b,c,d'; // only 4 columns here

            csv2go.parse( content, schema, null, function( err ){
                assert.isNotNull( err );
                assert.equal( err, 'Input out of range. On property text' );
                done();
            });
        });


        /* range */

        it('should not fail on too many specified columns', function( done ){
            schema = {
                sum: {
                    type: 'Integer',
                    range: 4,
                    aggregate: 'sum'
                }
            };
            content = '2,4';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].sum, 6 );
                done();
            });
        });


        /*********************************
         * String type tests
         *********************************/

        it('should return one object fully filled when called with a simple schema', function( done ){
            schema = {
                text: 'String',
                untrimmed: 'String',
                number: 'Integer'
            };
            content = '"Don\'t panic!", The answer is: , 42';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );

                var item = result[0];
                assert.strictEqual( item.text, 'Don\'t panic!' );
                assert.strictEqual( item.untrimmed, ' The answer is: ' );
                assert.strictEqual( item.number, 42 );

                done();
            });
        });

        it('should handle string types with concat on aggregate', function( done ){
            schema = {
                text: {
                    type: 'String',
                    range: 2,
                    aggregate: 'concat'
                },
                number: 'Integer'
            };
            content = 'This is a, separated string, 42';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );

                var item = result[0];
                assert.strictEqual( item.text, 'This is a separated string' );
                assert.strictEqual( item.number, 42 );

                done();
            });
        });

        /*********************************
         * Integer type tests
         *********************************/

        it('should parse integer types', function( done ){
            schema = {
                x: 'Integer',
                y: 'Integer',
                z: 'Integer'
            };
            content = '2,4,8\n20,32,1';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 2 );
                assert.strictEqual( result[0].x, 2 );
                assert.strictEqual( result[0].y, 4 );
                assert.strictEqual( result[0].z, 8 );
                assert.strictEqual( result[1].x, 20 );
                assert.strictEqual( result[1].y, 32 );
                assert.strictEqual( result[1].z, 1 );
                done();
            });
        });

        it('should handle enormous numbers without overflows', function( done ){
            schema = {
                x: 'Integer',
                y: 'Integer'
            };
            content = '200000000000000000000000000000000000000000000000000000,4';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].x, 200000000000000000000000000000000000000000000000000000 );
                assert.strictEqual( result[0].y, 4 );
                done();
            });
        });

        it('should handle integer types with sum on aggregate', function( done ){
            schema = {
                sum: {
                    type: 'Integer',
                    range: 4,
                    aggregate: 'sum'
                }
            };
            content = '2,4,8,1';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].sum, 15 );
                done();
            });
        });

        it('should handle integer types with avg on aggregate', function( done ){
            schema = {
                avg: {
                    type: 'Integer',
                    range: 4,
                    aggregate: 'avg'
                }
            };
            content = '2,4,8,2';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].avg, 4 );
                done();
            });
        });

        it('should handle integer types with avg on aggregate and return a float, if average is not an integer', function( done ){
            schema = {
                avg: {
                    type: 'Integer',
                    range: 4,
                    aggregate: 'avg'
                }
            };
            content = '2,4,8,5';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].avg, 4.75 );
                done();
            });
        });

        it('should handle integer types with min on aggregate', function( done ){
            schema = {
                min: {
                    type: 'Integer',
                    range: 4,
                    aggregate: 'min'
                }
            };
            content = '2,4,1,8';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].min, 1 );
                done();
            });
        });

        it('should handle integer types with max on aggregate', function( done ){
            schema = {
                max: {
                    type: 'Integer',
                    range: 4,
                    aggregate: 'max'
                }
            };
            content = '2,4,1,8';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].max, 8 );
                done();
            });
        });

        it('should parse float values as integers if specified', function( done ){
            schema = {
                x: 'Integer',
                y: 'Integer',
                z: 'Integer'
            };
            content = '2.2,4.3,8.0';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].x, 2 );
                assert.strictEqual( result[0].y, 4 );
                assert.strictEqual( result[0].z, 8 );
                done();
            });
        });

        /*********************************
         * Integer type tests
         *********************************/

        it('should parse float types', function( done ){
            schema = {
                x: 'Float',
                y: 'Float',
                z: 'Float'
            };
            content = '2.2,4.3,8.00099';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].x, 2.2 );
                assert.strictEqual( result[0].y, 4.3 );
                assert.strictEqual( result[0].z, 8.00099 );
                done();
            });
        });

        it('should parse float numbers with thousand separator', function( done ){
            var prepare = function( item ){
                return item.replace(/,/g, '')
            };
            schema = {
                x: {
                    type: 'Float',
                    prepare: prepare
                },
                y: 'Float',
                z: {
                    type: 'Float',
                    prepare: prepare
                }
            };
            content = '1,002.2 | 4.3 | 8,001.0';
            options = {
                delimiter: '|'
            };

            csv2go.parse( content, schema, options, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].x, 1002.2 );
                assert.strictEqual( result[0].y, 4.3 );
                assert.strictEqual( result[0].z, 8001.0 );
                done();
            });
        });


        /*********************************
         * Date type tests
         *********************************/

        it('should parse float types', function( done ){
            schema = {
                x: 'Date',
                y: 'String',
                z: 'String'
            };
            content = '2015-11-11,Some,Value,23';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].x.getTime(), new Date(2015,10,11).getTime() );
                assert.strictEqual( result[0].y, 'Some' );
                assert.strictEqual( result[0].z, 'Value' );
                done();
            });
        });


        /*********************************
         * Type template tests
         *********************************/

        it('should support objects passed to the schema as types, even if those objects are passed multiple times', function( done ){
            var template = {
                type: 'Float',
                parse: function( item ){
                    return parseFloat( item.substring(0,5) );
                }
            };
            schema = {
                x: template,
                y: 'Integer',
                z: template
            };
            content = '123.4_test,333,345.67_abc';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].x, 123.4 );
                assert.strictEqual( result[0].y, 333 );
                assert.strictEqual( result[0].z, 345.6 );
                done();
            });
        });

        it('should support type templates with prepare, parse, apply and aggregate', function( done ){
            var template = {
                type: 'Integer',
                range: 3,
                prepare: function( item ){
                    return item + '0';
                },
                parse: function( item, index ){
                    return parseInt( item ) * index;
                },
                apply: function( item ){
                    return parseInt( item ) * 2;
                },
                aggregate: 'sum'
            };
            schema = {
                x: template,
                y: 'String',
                z: template
            };
            content = '1,2,3,Test,12,43,03';

            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].x, 160 ); // sum of: (10 * 0 + 20 * 1 + 30 * 2) * 2
                assert.strictEqual( result[0].y, 'Test' );
                assert.strictEqual( result[0].z, 980 ); // sum of: (120 * 0 + 430 * 1 + 30 * 2) * 2
                done();
            });
        });


        /*********************************
         * Custom types tests
         *********************************/

        it('should support custom types via register', function( done ){
            var moneyType = {
                type: 'Money',
                apply: function( item ){
                    return parseFloat(item.toFixed(2)); // as usual for money, round to two places
                }
            };
            schema = {
                x: 'Money',
                y: 'Integer',
                z: 'Money'
            };
            content = '123.4478,333,345.6745';

            csv2go.register( moneyType, 'Float' );
            csv2go.parse( content, schema, null, function(err, result){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].x, 123.45 );
                assert.strictEqual( result[0].y, 333 );
                assert.strictEqual( result[0].z, 345.67 );

                csv2go.unregister( 'Money' );
                done();
            });
        });

        it('should return an error on unknown type', function( done ){
            schema = {
                x: 'Money',
                y: 'Integer',
                z: 'Money'
            };
            content = '123.4478,333,345.6745';

            // do not register 'Money' -> error should be returned
            csv2go.parse( content, schema, null, function( err ){
                assert.equal(err, 'Unknown type Money. On property x' );
                done();
            });
        });

        it('should allow unregistering custom types', function( done ){
            var moneyType = {
                type: 'Money',
                apply: function( item ){
                    return parseFloat(item.toFixed(2)); // as usual for money, round to two places
                }
            };
            schema = {
                x: 'Money'
            };
            content = '123.4478';

            csv2go.register( moneyType, 'Float' );
            csv2go.parse( content, schema, null, function( err, result ){
                assert.lengthOf( result, 1 );
                assert.strictEqual( result[0].x, 123.45 );

                csv2go.unregister( 'Money' ); // no exception here
                done();
            });
        });

        it('should throw and exception on unregistering a predefined type', function( ){
            wrapper = function() {
                csv2go.unregister( 'Float' );
            };
            assert.throws( wrapper, 'Cannot remove built-in type Float' );
        });

    });


    describe('parseLine()', function() {

        it('should parse a file and return the values as list', function( done ){
            schema = {
                name: 'String',
                sum: {
                    type: 'Integer',
                    range: 3,
                    aggregate: 'sum'
                }
            };
            options = {
                delimiter: ';'
            };

            csv2go.parseFile( 'test/test.csv', schema, options, function(err, result){
                assert.lengthOf( result, 2 );
                assert.strictEqual( result[0].name, 'test' );
                assert.strictEqual( result[0].sum, 6 );
                assert.strictEqual( result[1].name, 'other' );
                assert.strictEqual( result[1].sum, 10 );
                done();
            });
        });

    });
});







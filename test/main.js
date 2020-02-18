let Validator = require ('../Validator');

let tests = {
	'integer': {
		valid: [ 0, 1, 2, 10, 11, 9999999, -1, -5, -10, -1e+22, 9007199254740991, -9007199254740991, '465', '-612' ],
		invalid: [ undefined, null, 0.01, 1.01, 9999999.999999998, -1.5, -5.9999, 'a', '0e5', -9999999.999999998, 'zero', 'one', 'true', 'false', true, false, { '0': 1 }, [ 1 ], [ 'a' ], '0xFFF' ]
	},
	'number': {
		valid: [ 0, 1, 2, 10, 11, 9999999, -1, -5, -10, -1e+22, 9007199254740991, -9007199254740991, '465', '-612', 0.01, 1.01, 9999999.999999998, -1.5, -5.9999, -9999999.999999998 ],
		invalid: [ undefined, null, 'a', '0e5', 'zero', 'one', 'true', 'false', true, false, { '0': 1 }, [ 1 ], [ 'a' ], '0xFFF' ]
	},
	'string': {
		valid: [ '0', '1', new String (2), '10', 'true', 'false', 'abc' ],
		invalid: [ undefined, null, 0, true, false, 9007199254740991, { '0': 1 }, { hello: 'world' }, [ 'yo!' ], [ 'a' ], 4095 ]
	},
	'email': {
		valid: [ 'x@x.xx', 'joske@joske.be', 'valid.email+address@gmail.com'],
		invalid: [ undefined, null, 0, true, false, 9007199254740991, { '0': 1 }, { hello: 'world' }, [ 'yo@derp.com' ], [ 'yo!' ], 4095, 'x@x.x' ]
	},
	'url': {
		valid: [ 'http://google.com', 'http://google.com/', 'https://google.com', 'https://google.com/', 'http://ko.wikipedia.org/wiki/위키백과:대문?test=yes'],
		invalid: [ undefined, null, 'ftp://x@derp.com', 'google.com', 'http://google', 0, true, false, 9007199254740991, { '0': 1 }, { hello: 'world' }, [ 'yo@derp.com' ], [ 'yo!' ], 4095, 'x@x.x' ]
	},
	'length:3': {
		valid: [ [0, 1, 2], 222, '123', 'abc' ],
		invalid: [ undefined, null, [0, 1, 2, 3], 1234, 01, 'ab', 'abcd', { 0: 0, 1: 1, 2: 2 } ]
	},
	'maxlength:3': {
		valid: [ [0, 1, 2], 222, '123', 'abc', 'ab', 'a' ],
		invalid: [ undefined, null, [0, 1, 2, 3], 1234, 'abcd', { 0: 0, 1: 1, 2: 2 } ]
	},
	'minlength:3': {
		valid: [ [0, 1, 2], 222, '123', 'abc', 'abcd', [0, 1, 2, 3, 4, 5] ],
		invalid: [ undefined, null, [0, 1], 12, 01, 'ab', { 0: 0, 1: 1, 2: 2 } ]
	},
	'in:0,false,joske,50': {
		valid: [ '0', 0, false, 'false', 'joske', 50, '50' ],
		invalid: [ undefined, null, [0, 1], [0], [ false ], [ 'false' ], { 0: false }, { '0': 0 }, 'joske0', 'fifty' ]
	},
	// same //
	// different //
	// required_with //
	// required_if //
	'lowercase': {
		valid: [ '0', '1', new String (2), '10', 'true', 'false', 'abc', 'lorem ipsum' ],
		invalid: [ undefined, null, 0, true, false, 9007199254740991, { '0': 1 }, { hello: 'world' }, [ 'yo!' ], [ 'a' ], 409, 5, 'UPPERCASE STRING', 'Joske' ]
	},
	'uppercase': {
		valid: [ '0', '1', new String (2), '10', 'TRUE', 'FALSE', 'ABC', 'LOREM IPSUM' ],
		invalid: [ undefined, null, 0, true, false, 9007199254740991, { '0': 1 }, { HELLO: 'WORLD' }, [ 'YO!' ], [ 'A' ], 409, 5, 'lowercase string', 'Joske' ]
	},
	'alpha': {
		valid: [ 'AbcD', 'aaaaaaaaaaaaaaaaaaaa', new String ('NOOTNOOT'), 'TRUE', 'FALSE', 'ABC', 'LÖRẼMÏPSÚM', 'Knödel', 'Hé', 'nĭhăo' ],
		invalid: [ undefined, null, 0, true, false, 9007199254740991, { '0': 1 }, { HELLO: 'WORLD' }, [ 'YO!' ], [ 'A' ], 409, 5, 'hello@example', 'how are you', 'hello123', '1+1=2', 'a.b', '1.25', '1,25', '1-2', 'A-z', '0_o' ]
	},
	'alpha_num': {
		valid: [ 'AbcD', 'aaaaaaaaaaaaaaaaaaaa', new String ('NOOTNOOT'), 'TRUE', 'FALSE', 'ABC', 'LÖRẼMÏPSÚM', 'Knödel', 'Hé', 'nĭhăo', 'hello123' ],
		invalid: [ undefined, null, 0, true, false, 9007199254740991, { '0': 1 }, { HELLO: 'WORLD' }, [ 'YO!' ], [ 'A' ], 409, 5, 'hello@example', 'how are you', '1+1=2', 'a.b', '1.25', '1,25', '1-2', 'A-z', '0_o' ]
	},
	'alpha_dash': {
		valid: [ 'AbcD', 'aaaaaaaaaaaaaaaaaaaa', new String ('NOOTNOOT'), 'TRUE', 'FALSE', 'ABC', 'LÖRẼMÏPSÚM', 'Knödel', 'Hé', 'nĭhăo', '1-2', 'A-z', '0_o' ],
		invalid: [ undefined, null, 0, true, false, 9007199254740991, { '0': 1 }, { HELLO: 'WORLD' }, [ 'YO!' ], [ 'A' ], 409, 5, 'hello@example', 'how are you', '1+1=2', 'a.b', '1.25', '1,25' ]
	},
	'date': {
		valid: [ '2017-10-04', '9999-12-31', '2017-09-30', '2017-08-31' ],
		invalid: [ undefined, null, '04-10-2017', '31-09-2017', '45-85-3528', '3528-85-45', '1-02-31', 'Wednesday the 4th of October, 2017', '2017/10/04', '2017.10.04', '1-1-1', '2099-1-2', '2099-01-2', '2099-1-02', '2017-10-00', '2017-0-0', '2017-10-0' ]
	},
	'date:before:2017-10-04': {
		valid: [ '2017-10-03', '2017-09-30', '1995-02-03' ],
		invalid: [ undefined, null, '04-10-2017', '05-10-2017', '31-09-2018', '45-85-3528', '3528-85-45', '1-02-31', 'Wednesday the 4th of October, 2017', '2017/10/04', '2017.10.04', '1-1-1', '2099-1-2', '2099-01-2', '2099-1-02', '2017-10-00', '2017-0-0', '2017-10-0' ]
	},
	'date:after:2017-10-04': {
		valid: [ '2017-10-05', '9999-12-31', '2017-11-30' ],
		invalid: [ undefined, null, '04-10-2017', '31-09-2017', '45-85-3528', '3528-85-45', '1-02-31', 'Wednesday the 4th of October, 2017', '2017/10/00', '2017.10.04', '1-1-1', '2099-1-2', '2099-01-2', '2099-1-02', '2017-08-31', '2017-10-00', '2017-0-0', '2017-10-0' ]
	},
	'date:equal:2017-10-04': {
		valid: [ '2017-10-04', new Date ('2017-10-04') ],
		invalid: [ undefined, null, '04-10-2017', '31-09-2017', '45-85-3528', '3528-85-45', '1-02-31', 'Wednesday the 4th of October, 2017', '2017/10/04', '2017.10.04', '1-1-1', '2099-1-2', '2099-01-2', '2099-1-02', '9999-12-31', '2017-09-30', '2017-08-31', '2017-10-00', '2017-0-0', '2017-10-0' ]
	},
	'date:after:now': {
		valid: [ new Date('9999-12-31') ],
		invalid: [ undefined, null, new Date('2017-10-03'), '2017-10-03' ]
	},
	'boolean': {
		valid: [ true, false, 'true', 'false', 0, 1, '0', '1' ],
		invalid: [ undefined, null, new Date('2017-10-03'), '2017-10-03', 'yes', 'no', '', 'herpederp', 2, -1, 111, 100, 1.1, {}, [] ]
	},
	'object': {
		valid: [ {}, { key: 'value' }, new Date () ],
		invalid: [ undefined, null, '2017-10-03', 'yes', 'no', '', 'herpederp', 2, -1, 111, 100, 1.1, true, false, 'true', 'false', 0, 1, '0', '1', [], [1, '2', 'three'] ]
	},
	'distinct': {
		valid: [
			[ 1, 'joske', '1', [ 1 ], { value: 1 }, new Date () ],
			[ new Date ('2017-11-02'), '2017-11-02' ],
			[ true, 'true' ],
			[ false, 'false', 0 ]
		],
		invalid: [
			[ '1', '1' ],
			[ 1, 1 ],
			[ 0, 0 ],
			[ new Date ('2017-11-02'), new Date ('2017-11-02') ],
			[ 'NOOT NOOT', 'NOOT NOOT' ],
			[ {}, {} ],
			[ { key: 'value' }, { key: 'value' } ],
			[ 1.0, 1 ],
			[ `x`, new String ('x') ],
			[ "x", `x` ],
			[ [ 1, 2, 3 ], [ 1, 2, 3 ] ],
			[ { '1': 1, '2': 2, x: 'x' }, { '2': 2, x: 'x', '1': 1 } ]
		]
	},
	//TODO// ip //
	'ipv4': {
		valid: [ '0.0.0.1', '255.255.255.254', '127.0.0.1', '188.226.180.226', '0.0.0.0', '255.255.255.255' ],
		invalid: [ undefined, null, '127.0.0.256', [], {}, 127, true, false, 0, 1, ['127.0.0.1'], '*', '127.0.0.1/24' ]
	},
	//TODO//
};

for (const rule in tests)
{
	let valid = {};
	let validRules = {};
	let invalid = {};
	let invalidRules = {};
	
	for (let validInput of tests[rule].valid)
	{
		const key = getValueType(validInput) + '::' + String (validInput);
		valid[key] = validInput;
		validRules[key] = [ rule ];
	}
	for (let invalidInput of tests[rule].invalid)
	{
		const key = getValueType(invalidInput) + '::' + String (invalidInput);
		invalid[key] = invalidInput;
		invalidRules[key] = [ rule ];
	}
	
	describe (rule, () => {
		it ('should validate', (done) => {
			const validator = new Validator (valid, validRules);
			
			if (validator.validate ())
				done ();
			else
				done (validator.errors);
		});
	
		it ('should not validate', (done) => {
			const validator = new Validator (invalid, invalidRules);
			validator.reverse = true;
			
			if (validator.validate ())
				done ();
			else
				done (validator.errors);
		});
	});
}

function getValueType(value)
{
	if (value === null || value === undefined || !value.constructor)
		return 'lang';
	return value.constructor.name;
}

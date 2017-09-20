let Validator = require ('../Validator');

let tests = {
	'integer': {
		valid: [ 0, 1, 2, 10, 11, 9999999, -1, -5, -10, -1e+22, 9007199254740991, -9007199254740991, '465', '-612' ],
		invalid: [ 0.01, 1.01, 9999999.999999998, -1.5, -5.9999, 'a', '0e5', -9999999.999999998, 'zero', 'one', 'true', 'false', true, false, { '0': 1 }, [ 1 ], [ 'a' ], '0xFFF' ]
	},
	'number': {
		valid: [ 0, 1, 2, 10, 11, 9999999, -1, -5, -10, -1e+22, 9007199254740991, -9007199254740991, '465', '-612', 0.01, 1.01, 9999999.999999998, -1.5, -5.9999, -9999999.999999998 ],
		invalid: [ 'a', '0e5', 'zero', 'one', 'true', 'false', true, false, { '0': 1 }, [ 1 ], [ 'a' ], '0xFFF' ]
	},
	'string': {
		valid: [ '0', '1', new String (2), '10', 'true', 'false', 'abc' ],
		invalid: [ 0, true, false, 9007199254740991, { '0': 1 }, { hello: 'world' }, [ 'yo!' ], [ 'a' ], 4095 ]
	},
	'email': {
		valid: [ 'x@x.xx', 'joske@joske.be', 'valid.email+address@gmail.com'],
		invalid: [ 0, true, false, 9007199254740991, { '0': 1 }, { hello: 'world' }, [ 'yo@derp.com' ], [ 'yo!' ], 4095, 'x@x.x' ]
	},
	'url': {
		valid: [ 'http://google.com', 'http://google.com/', 'https://google.com', 'https://google.com/', 'http://ko.wikipedia.org/wiki/위키백과:대문?test=yes'],
		invalid: [ 'ftp://x@derp.com', 'google.com', 'http://google', 0, true, false, 9007199254740991, { '0': 1 }, { hello: 'world' }, [ 'yo@derp.com' ], [ 'yo!' ], 4095, 'x@x.x' ]
	},
	'length:3': {
		valid: [ [0, 1, 2], 222, '123', 'abc' ],
		invalid: [ [0, 1, 2, 3], 1234, 01, 'ab', 'abcd', { 0: 0, 1: 1, 2: 2 } ]
	},
	'maxlength:3': {
		valid: [ [0, 1, 2], 222, '123', 'abc', 'ab', 'a' ],
		invalid: [ [0, 1, 2, 3], 1234, 'abcd', { 0: 0, 1: 1, 2: 2 } ]
	},
	'minlength:3': {
		valid: [ [0, 1, 2], 222, '123', 'abc', 'abcd', [0, 1, 2, 3, 4, 5] ],
		invalid: [ [0, 1], 12, 01, 'ab', { 0: 0, 1: 1, 2: 2 } ]
	},
	'in:0,false,joske,50': {
		valid: [ '0', 0, false, 'false', 'joske', 50, '50' ],
		invalid: [ [0, 1], [0], [ false ], [ 'false' ], { 0: false }, { '0': 0 }, 'joske0', 'fifty' ]
	},
	// same //
	// different //
	// required_with //
	// required_if //
	'lowercase': {
		valid: [ '0', '1', new String (2), '10', 'true', 'false', 'abc', 'lorem ipsum' ],
		invalid: [ 0, true, false, 9007199254740991, { '0': 1 }, { hello: 'world' }, [ 'yo!' ], [ 'a' ], 409, 5, 'UPPERCASE STRING', 'Joske' ]
	},
	'uppercase': {
		valid: [ '0', '1', new String (2), '10', 'TRUE', 'FALSE', 'ABC', 'LOREM IPSUM' ],
		invalid: [ 0, true, false, 9007199254740991, { '0': 1 }, { HELLO: 'WORLD' }, [ 'YO!' ], [ 'A' ], 409, 5, 'lowercase string', 'Joske' ]
	},
	'alpha': {
		valid: [ 'AbcD', 'aaaaaaaaaaaaaaaaaaaa', new String ('NOOTNOOT'), 'TRUE', 'FALSE', 'ABC', 'LÖRẼMÏPSÚM', 'Knödel', 'Hé', 'nĭhăo' ],
		invalid: [ 0, true, false, 9007199254740991, { '0': 1 }, { HELLO: 'WORLD' }, [ 'YO!' ], [ 'A' ], 409, 5, 'hello@example', 'how are you', 'hello123', '1+1=2', 'a.b', '1.25', '1,25', '1-2', 'A-z', '0_o' ]
	},
	'alpha_num': {
		valid: [ 'AbcD', 'aaaaaaaaaaaaaaaaaaaa', new String ('NOOTNOOT'), 'TRUE', 'FALSE', 'ABC', 'LÖRẼMÏPSÚM', 'Knödel', 'Hé', 'nĭhăo', 'hello123' ],
		invalid: [ 0, true, false, 9007199254740991, { '0': 1 }, { HELLO: 'WORLD' }, [ 'YO!' ], [ 'A' ], 409, 5, 'hello@example', 'how are you', '1+1=2', 'a.b', '1.25', '1,25', '1-2', 'A-z', '0_o' ]
	},
	'alpha_dash': {
		valid: [ 'AbcD', 'aaaaaaaaaaaaaaaaaaaa', new String ('NOOTNOOT'), 'TRUE', 'FALSE', 'ABC', 'LÖRẼMÏPSÚM', 'Knödel', 'Hé', 'nĭhăo', '1-2', 'A-z', '0_o' ],
		invalid: [ 0, true, false, 9007199254740991, { '0': 1 }, { HELLO: 'WORLD' }, [ 'YO!' ], [ 'A' ], 409, 5, 'hello@example', 'how are you', '1+1=2', 'a.b', '1.25', '1,25' ]
	}
	//TODO//
};

for (let rule in tests)
{
	let valid = {};
	let validRules = {};
	let invalid = {};
	let invalidRules = {};
	
	for (let validInput of tests[rule].valid)
	{
		let key = validInput.constructor.name + '::' + String (validInput);
		valid[key] = validInput;
		validRules[key] = [ rule ];
	}
	for (let invalidInput of tests[rule].invalid)
	{
		let key = invalidInput.constructor.name + '::' + String (invalidInput);
		invalid[key] = invalidInput;
		invalidRules[key] = [ rule ];
	}
	
	describe (rule, () => {
		it ('should validate', (done) => {
			let validator = new Validator (valid, validRules);
			
			if (validator.validate ())
				done ();
			else
				done (validator.errors);
		});
	
		it ('should not validate', (done) => {
			let validator = new Validator (invalid, invalidRules);
			validator.reverse = true;
			
			if (validator.validate ())
				done ();
			else
				done (validator.errors);
		});
	});
}


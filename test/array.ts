import Validator = require('../src/Validator');

let tests: { rules: any[], valid: any[], invalid: any[] }[] = [
	{
		rules: ['array'],
		valid: [ [], ['a'], ['a','b'], [1, 2, 3], [null], [undefined], [{}], [['a'],['b']], new Array(3) ],
		invalid: [ undefined, null, '', 'nope', 'a,b', 0, 1, true, false, {}, { 0: 'a' }, new Date() ]
	},
	{
		rules: ['array', 'string'],
		valid: [ [], ['a'], ['a','b'], ['', 'x'] ],
		invalid: [ ['a', 1], [1], [null], [undefined], [['a']], [{}], 'nope', {} ]
	},
	{
		rules: ['array', 'minlength:3'],
		valid: [ [], ['abc'], ['abcd','efgh'] ],
		invalid: [ ['ab'], ['abc','de'], ['',''], 'nope' ]
	},
	{
		rules: ['array', 'array'],
		valid: [ [], [[]], [['a']], [['a'],['b']] ],
		invalid: [ ['a'], ['a',['b']], [1], 'nope' ]
	},
	{
		rules: ['optional', 'array', 'string'],
		valid: [ undefined, null, [], ['a'], ['a','b'], [null] ],
		invalid: [ ['a', 1], [1], 'nope', {} ]
	},
	{
		rules: ['required', 'array'],
		valid: [ ['a'], ['x','y'], [1], [0], [false] ],
		invalid: [ [], undefined, null, '', 'nope', [null], [''] ]
	}
];

for (const { rules, valid, invalid } of tests)
{
	describe(rules.join(', '), () => {
		valid.forEach(validValue => {
			it(`"${JSON.stringify(validValue)}" should be valid according to rules "${rules.join(', ')}"`, done => {
				const validator = new Validator({
					subject: validValue
				}, {
					subject: [...rules]
				});
				if (validator.validate()) {
					done();
					return;
				}

				done(validator.errors);
			});
		});

		invalid.forEach(invalidValue => {
			it(`"${JSON.stringify(invalidValue)}" should be invalid according to rules "${rules.join(', ')}"`, done => {
				const validator = new Validator({
					subject: invalidValue
				}, {
					subject: [...rules]
				});
				validator.reverse = true;
				if (validator.validate()) {
					done();
					return;
				}

				done(validator.errors);
			});
		});
	});
}

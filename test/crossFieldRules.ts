import Validator = require('../src/Validator');

let tests: Record<string, { valid: any[], invalid: any[] }> = {
	'same:other': {
		valid: [
			{ subject: 'x', other: 'x' },
			{ subject: '', other: '' },
			{ subject: 0, other: 0 },
			{ subject: false, other: false },
			{ subject: null, other: null }
		],
		invalid: [
			{ subject: 'x', other: 'y' },
			{ subject: 'x', other: 'X' },
			{ subject: 1, other: '1' },
			{ subject: 0, other: false },
			{ subject: '', other: null },
			{ subject: 'x' }
		]
	},
	'same:a,b': {
		valid: [
			{ subject: 'x', a: 'x', b: 'x' }
		],
		invalid: [
			{ subject: 'x', a: 'x', b: 'y' },
			{ subject: 'x', a: 'y', b: 'x' },
			{ subject: 'x', a: 'y', b: 'y' },
			{ subject: 'x', a: 'x' }
		]
	},
	'different:other': {
		valid: [
			{ subject: 'x', other: 'y' },
			{ subject: 'x', other: 'X' },
			{ subject: 1, other: '1' },
			{ subject: 0, other: false },
			{ subject: 'x' }
		],
		invalid: [
			{ subject: 'x', other: 'x' },
			{ subject: 1, other: 1 },
			{ subject: '', other: '' },
			{ subject: null, other: null }
		]
	},
	'different:a,b': {
		valid: [
			{ subject: 'x', a: 'y', b: 'z' }
		],
		invalid: [
			{ subject: 'x', a: 'x', b: 'z' },
			{ subject: 'x', a: 'y', b: 'x' },
			{ subject: 'x', a: 'y', b: 'y' }
		]
	},
	'required_with:other': {
		valid: [
			{ subject: 'x', other: 'set' },
			{ subject: 0, other: 'set' },
			{ subject: false, other: 'set' },
			{ subject: '' },
			{ subject: '', other: null },
			{ subject: '', other: undefined }
		],
		invalid: [
			{ subject: '', other: 'set' },
			{ subject: null, other: 'set' },
			{ subject: undefined, other: 'set' },
			{ other: 'set' }
		]
	},
	'required_if:gender,unspecified': {
		valid: [
			{ gender: 'unspecified', subject: 'x' },
			{ gender: 'unspecified', subject: 'lorem ipsum' },
			{ gender: 'unspecified', subject: 0 },
			{ gender: 'unspecified', subject: false },
			{ gender: 'unspecified', subject: [] },
			{ gender: 'unspecified', subject: {} },
			{ gender: 'male', subject: '' },
			{ gender: 'male', subject: null },
			{ gender: 'male', subject: undefined },
			{ gender: 'male' },
			{ gender: 'unspecifie', subject: '' },
			{ gender: 'unspecifiedd', subject: '' },
			{ gender: 'UNSPECIFIED', subject: '' },
			{ gender: '', subject: '' },
			{ gender: null, subject: '' },
			{ gender: 0, subject: '' },
			{ gender: false, subject: '' },
			{ subject: '' },
			{}
		],
		invalid: [
			{ gender: 'unspecified', subject: '' },
			{ gender: 'unspecified', subject: null },
			{ gender: 'unspecified', subject: undefined },
			{ gender: 'unspecified' },
			{ gender: ['unspecified'], subject: '' }
		]
	},
	'required_if:age,18': {
		valid: [
			{ age: 18, subject: 'x' },
			{ age: '18', subject: 'x' },
			{ age: 19, subject: '' },
			{ age: '19', subject: '' },
			{ age: 180, subject: '' },
			{ age: 1, subject: '' },
			{ age: null, subject: '' },
			{ subject: '' }
		],
		invalid: [
			{ age: 18, subject: '' },
			{ age: '18', subject: '' },
			{ age: 18 }
		]
	}
};

for (const rule in tests)
{
	describe(rule, () => {
		const { valid, invalid } = tests[rule];

		valid.forEach(input => {
			it(`${JSON.stringify(input)} should be valid according to rule "${rule}"`, done => {
				const validator = new Validator(input, {
					subject: [rule]
				});
				if (validator.validate()) {
					done();
					return;
				}

				done(validator.errors);
			});
		});

		invalid.forEach(input => {
			it(`${JSON.stringify(input)} should be invalid according to rule "${rule}"`, done => {
				const validator = new Validator(input, {
					subject: [rule]
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

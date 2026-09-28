import Validator = require('../src/Validator');

let tests: Record<string, { valid: any[], invalid: any[] }> = {
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

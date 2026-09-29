process.env.TZ = 'UTC';

import assert from 'assert';
import Validator = require('../src/Validator');

describe('README example', () => {
	const rules = {
		first_name: ['required', 'min:3'],
		last_name: 'required|min:3',
		username: ['required', 'min:3', 'lowercase'],
		email: ['required', 'email', 'lowercase'],
		password: ['required', 'min:8', 'confirmed'],
		dob: ['required', 'date', 'before:2010-01-01'],
		gender: ['required', 'in:male,female,unspecified'],
		tags: ['nullable', 'array', 'max:32'],
		'tags.*': 'string|min:3',
		location: {
			country: ['required', 'size:2'],
			city: ['nullable', 'min:3'],
		},
	};

	it('accepts valid input', () => {
		const validation = new Validator({
			first_name: 'Robin', last_name: 'Jacobs', username: 'robin', email: 'robin@example.com',
			password: 'hunter2hunter2', password_confirmation: 'hunter2hunter2', dob: '1995-02-03', gender: 'unspecified',
			tags: ['one', 'two'], location: { country: 'IE', city: null },
		}, rules);

		assert.strictEqual(validation.validate(), true);
		assert.strictEqual(validation.valid, true);
		assert.deepStrictEqual(validation.errors, []);
	});

	it('reports every failing rule with Laravel wording', () => {
		const validation = new Validator({
			first_name: 'R', username: 'Robin', email: 'nope', password: 'short', password_confirmation: 'other',
			dob: '2015-01-01', gender: 'x', tags: ['a', 1], location: { country: 'IRL' },
		}, rules);

		assert.strictEqual(validation.validate(), false);
		assert.deepStrictEqual(validation.errors, [
			'The first name field must be at least 3 characters.',
			'The last name field is required.',
			'The username field must be lowercase.',
			'The email field must be a valid email address.',
			'The password field must be at least 8 characters.',
			'The password field confirmation does not match.',
			'The dob field must be a date before 2010-01-01.',
			'The selected gender is invalid.',
			'The location.country field must be 2 characters.',
			'The tags.0 field must be at least 3 characters.',
			'The tags.1 field must be a string.',
			'The tags.1 field must be at least 3 characters.',
		]);
		assert.deepStrictEqual(validation.fieldErrors[0], { field: 'first_name', error: 'The first name field must be at least 3 characters.' });
		assert.deepStrictEqual(validation.messages.password, [
			'The password field must be at least 8 characters.',
			'The password field confirmation does not match.',
		]);
		assert.deepStrictEqual(Object.keys(validation.failed().password), ['min', 'confirmed']);
	});
});

describe('Custom messages and attribute names', () => {
	it('uses inline messages, attribute names and size-aware messages', () => {
		const v = new Validator({ email: '', age: 'x', items: [1] }, {
			email: 'required',
			age: 'integer',
			items: 'array|min:2',
		}, {
			'email.required': 'Give us your :attribute!',
			integer: 'Whole numbers only for :Attribute.',
			min: { array: ':attribute needs :min or more entries' },
		}, { email: 'e-mail address' });

		assert.strictEqual(v.validate(), false);
		assert.deepStrictEqual(v.errors, [
			'Give us your e-mail address!',
			'Whole numbers only for Age.',
			'items needs 2 or more entries',
		]);
	});

	it('replaces :other, :values, :date and :input placeholders', () => {
		const v = new Validator({ a: 'x', b: 'x', c: '', d: 'late', role: 'admin', when: '2030-01-01' }, {
			a: 'different:b',
			c: 'required_if:role,admin',
			d: 'in:early,on-time',
			when: 'before:2020-01-01',
		}, { in: ':input is not one of :values' });

		assert.strictEqual(v.validate(), false);
		assert.deepStrictEqual(v.errors, [
			'The a field and b must be different.',
			'The c field is required when role is admin.',
			'late is not one of early, on-time',
			'The when field must be a date before 2020-01-01.',
		]);
	});
});

describe('Wildcards, dots and nested rules', () => {
	it('expands wildcards and reports implicit attributes verbatim', () => {
		const v = new Validator({ users: [{ name: 'A', posts: [{ title: '' }] }, { name: '' }] }, {
			'users.*.name': 'required|min:2',
			'users.*.posts.*.title': 'required',
		});

		assert.strictEqual(v.validate(), false);
		assert.deepStrictEqual(v.messages, {
			'users.0.name': ['The users.0.name field must be at least 2 characters.'],
			'users.0.posts.0.title': ['The users.0.posts.0.title field is required.'],
			'users.1.name': ['The users.1.name field is required.'],
		});
	});

	it('treats nested rule objects as dotted keys', () => {
		const v = new Validator({ a: { b: { c: 'x' } } }, { a: { b: { c: 'integer' } } });

		assert.strictEqual(v.validate(), false);
		assert.deepStrictEqual(v.errors, ['The a.b.c field must be an integer.']);
	});

	it('escapes literal dots in keys', () => {
		const v = new Validator({ 'a.b': 'x' }, { 'a\\.b': 'integer', 'a.b': 'required' });

		assert.strictEqual(v.validate(), false);
		assert.deepStrictEqual(v.errors, ['The a.b field must be an integer.', 'The a.b field is required.']);
	});

	it('resolves asterisks in dependent rule parameters', () => {
		const v = new Validator({ items: [{ type: 'car', wheels: 4 }, { type: 'boat' }] }, {
			'items.*.wheels': 'required_if:items.*.type,car',
		});

		assert.strictEqual(v.validate(), true);
	});
});

describe('Implicit and optional rules', () => {
	it('skips non-implicit rules for missing or empty values', () => {
		assert.strictEqual(new Validator({}, { x: 'string|min:5' }).validate(), true);
		assert.strictEqual(new Validator({ x: '' }, { x: 'integer' }).validate(), true);
		assert.strictEqual(new Validator({ x: null }, { x: 'integer' }).validate(), false);
		assert.strictEqual(new Validator({ x: null }, { x: 'nullable|integer' }).validate(), true);
		assert.strictEqual(new Validator({}, { x: 'sometimes|required' }).validate(), true);
		assert.strictEqual(new Validator({ x: '' }, { x: 'sometimes|required' }).validate(), false);
	});

	it('stops after a failed implicit rule and honours bail', () => {
		const v = new Validator({ x: '' }, { x: 'required|string|min:3' });
		v.validate();
		assert.deepStrictEqual(v.errors, ['The x field is required.']);

		const bailed = new Validator({ x: 5 }, { x: 'bail|string|min:3' });
		bailed.validate();
		assert.deepStrictEqual(bailed.errors, ['The x field must be a string.']);

		const unbailed = new Validator({ x: 5 }, { x: 'string|min:3' });
		unbailed.validate();
		assert.strictEqual(unbailed.errors.length, 2);
	});

	it('stopOnFirstFailure halts after the first failing attribute', () => {
		const v = new Validator({}, { a: 'required', b: 'required' }).stopOnFirstFailure();

		assert.strictEqual(v.validate(), false);
		assert.deepStrictEqual(Object.keys(v.messages), ['a']);
	});
});

describe('validated(), exclude rules and sometimes()', () => {
	it('returns only validated data and honours exclude rules', () => {
		const v = new Validator({ name: 'x', secret: 'y', extra: 'z', tags: ['a', 'b'], meta: { keep: 1, drop: 2 } }, {
			name: 'required',
			secret: 'exclude',
			tags: 'array',
			'tags.*': 'string',
			'meta.keep': 'integer',
		});

		assert.deepStrictEqual(v.validated(), { name: 'x', tags: ['a', 'b'], meta: { keep: 1 } });
	});

	it('throws a ValidationError when data is invalid', () => {
		const v = new Validator({}, { name: 'required' });

		assert.throws(() => v.validated(), (e: any) => e instanceof Validator.ValidationError && e.errors.name[0] === 'The name field is required.');
	});

	it('adds conditional rules through sometimes()', () => {
		const v = new Validator({ games: 100 }, { games: 'integer' })
			.sometimes('reason', 'required', input => input.games >= 100);

		assert.strictEqual(v.validate(), false);
		assert.deepStrictEqual(v.errors, ['The reason field is required.']);
	});

	it('runs after() hooks', () => {
		const v = new Validator({ a: 1 }, { a: 'integer' }).after(validator => validator.addFailure('a', 'required'));

		assert.strictEqual(v.validate(), false);
		assert.deepStrictEqual(v.errors, ['The a field is required.']);
	});
});

describe('Closures and extensions', () => {
	it('runs closure rules', () => {
		const v = new Validator({ title: 'foo' }, {
			title: [(attribute, value, fail) => { if (value === 'foo') fail(`The ${attribute} may not be foo.`); }],
		});

		assert.strictEqual(v.validate(), false);
		assert.deepStrictEqual(v.errors, ['The title may not be foo.']);
	});

	it('supports Validator.extend() with messages and replacers', () => {
		Validator.extend('even', (_attribute, value) => Number(value) % 2 === 0, 'The :attribute field must be :kind.');
		Validator.replacer('even', message => message.replace(':kind', 'even'));

		const v = new Validator({ n: 3 }, { n: 'even' });
		assert.strictEqual(v.validate(), false);
		assert.deepStrictEqual(v.errors, ['The n field must be even.']);
		assert.strictEqual(new Validator({ n: 4 }, { n: 'even' }).validate(), true);
	});

	it('throws on unknown rules', () => {
		assert.throws(() => new Validator({ a: 1 }, { a: 'nope' }).validate(), /validateNope does not exist/);
	});
});

describe('Dates', () => {
	it('understands the formats strtotime accepts', () => {
		for (const value of ['2017-10-04', '10/04/2017', '4 October 2017', 'October 4, 2017', '20171004', '2017-10-04 12:30', '2017-10-04T12:30:00Z'])
			assert.strictEqual(new Validator({ d: value }, { d: 'date' }).validate(), true, value);
		for (const value of ['2017-02-30', 'tomorrow', '2017', 'Wednesday the 4th of October, 2017', 12345, [], {}])
			assert.strictEqual(new Validator({ d: value }, { d: 'date' }).validate(), false, String(value));
	});

	it('compares relative dates and other fields', () => {
		assert.strictEqual(new Validator({ d: '+1 day' }, { d: 'after:now' }).validate(), true);
		assert.strictEqual(new Validator({ d: new Date('2000-01-01') }, { d: 'before:tomorrow|after:1999-12-31' }).validate(), true);
		assert.strictEqual(new Validator({ d: '2000-01-01', e: '2000-01-01' }, { d: 'date_equals:e' }).validate(), true);
		assert.strictEqual(new Validator({ d: '01/02/2000' }, { d: 'date_format:d/m/Y|after_or_equal:01/02/2000' }).validate(), true);
	});
});

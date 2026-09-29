# Input Field Validator [![Test](https://github.com/RobinJ1995/input-field-validator/actions/workflows/test.yml/badge.svg)](https://github.com/RobinJ1995/input-field-validator/actions/workflows/test.yml)

A JavaScript port of [Laravel's validation](https://laravel.com/docs/12.x/validation). The rules, their parameters, the
order in which they run and the error messages behave exactly like Laravel 12's `Illuminate\Validation\Validator`,
verified against 1500 cases lifted from Laravel's own test suite.

## Example

```js
const Validator = require('input-field-validator');

const validation = new Validator(
	req.body,
	{
		first_name: ['required', 'min:3'],
		last_name: 'required|min:3',
		username: ['required', 'min:3', 'lowercase', 'alpha_dash'],
		email: ['required', 'email', 'lowercase'],
		password: ['required', 'min:8', 'confirmed'],
		dob: ['required', 'date', 'before:2010-01-01'],
		gender: ['required', 'in:male,female,unspecified'],
		tags: ['nullable', 'array', 'max:32'],
		'tags.*': 'string|min:3',
		location: {
			country: ['required', 'size:2'],
			city: ['nullable', 'min:3']
		}
	}
);

if (!validation.validate ())
	throw new Error(validation.errors.join (', '));
```

Rules can be given as a pipe-delimited string or an array, exactly as in Laravel. Nested input is addressed with dot
notation (`'location.country'`) and wildcards (`'tags.*'`); nesting the rules object as in the example above is a
shorthand for the dotted form.

## Results

After `validate()` (alias of `passes()`; `fails()` is the inverse):

* `validation.valid` – `true` or `false`
* `validation.errors` – every message, in order (`$validator->errors()->all()` in Laravel)
* `validation.messages` – messages keyed by attribute (`$validator->errors()->toArray()`)
* `validation.fieldErrors` – `[{ field, error }, ...]`
* `validation.failed()` – the failed rules and their parameters, keyed by attribute
* `validation.validated()` – the validated input only; throws `Validator.ValidationError` if validation failed

Messages are Laravel's English ones, e.g. `The first name field is required.`. Custom messages and attribute names use
Laravel's formats:

```js
new Validator(input, rules,
	{ 'email.required': 'We need your :attribute.', min: { string: ':attribute is too short' } },
	{ email: 'e-mail address' });
```

## Rules

Every rule from the [Laravel docs](https://laravel.com/docs/12.x/validation#available-validation-rules) is
implemented with the same parameters and semantics, including `bail`, `nullable`, `sometimes`, the `required_*`,
`prohibited_*`, `present_*`, `missing_*` and `exclude_*` families, `gt`/`gte`/`lt`/`lte`, size rules that switch
between string length, numeric value and array count based on the other rules on the field, `date`/`date_format`/
`before`/`after` with PHP's date grammar (`tomorrow`, `+1 week`, `10/04/2017`, ...), `regex` with PHP delimiters and
modifiers (`regex:/^[a-z]+$/i`), `distinct`, `in_array`, `confirmed`, `timezone`, `uuid:4`, `ulid`, `decimal`,
`multiple_of`, and so on.

Behaviour worth knowing, because it is Laravel's:

* A missing key or an empty string only fails implicit rules such as `required`; `null` fails type rules unless the
  field is `nullable`.
* Once an implicit rule fails, the other rules on that field are skipped. Otherwise every failing rule produces a
  message; `bail` stops at the first.
* `min:3` on the number `20` checks the string length unless the field also has `numeric`, `integer` or `decimal`.
* `boolean` accepts `true`, `false`, `0`, `1`, `'0'` and `'1'`; `accepted` accepts `yes`, `on`, `1`, `'1'`, `true`,
  `'true'`.
* A plain object counts as an array (PHP has only arrays); `list` demands a real array.

Not available, since they need PHP infrastructure: `exists`, `unique`, `current_password`, `enum`, `encoding`,
`active_url` and the `dns`/`spoof` email checks throw. The file rules (`file`, `image`, `mimes`, `mimetypes`,
`extensions`, `dimensions`) always fail, as Laravel's do for non-file input.

## Extending

```js
Validator.extend('even', (attribute, value, parameters, validator) => value % 2 === 0, 'The :attribute field must be even.');

new Validator(input, {
	count: ['even', (attribute, value, fail) => { if (value > 100) fail('The :attribute field is too big.'); }]
});
```

`Validator.extendImplicit`, `Validator.extendDependent` and `Validator.replacer` mirror their Laravel counterparts, as
do `validator.sometimes()`, `validator.after()` and `validator.stopOnFirstFailure()`.

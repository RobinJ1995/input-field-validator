# Input Field Validator

A Javascript input validation library heavily inspired by [Laravel's input validation](https://laravel.com/docs/5.4/validation).

## Example

```js
let Validator = require ('input-field-validator');

let validation = new Validator
(
	req.body,
	{
		first_name: ['required', 'minlength:3'],
		last_name: ['required', 'minlength:3'],
		username: ['required', 'minlength:3', 'lowercase'],
		email: ['required', 'email', 'lowercase'],
		password: ['required', 'minlength:8'],
		password_confirm: ['required', 'same:password'],
		dob: ['required', 'date:before:2010-01-01'],
		gender: ['required', 'in:male,female,unspecified'],
		tags: ['optional', 'array', 'minlength:3', 'maxlength:32']
	}
);
```

## Available validators

* array
* required
* optional
* integer
* number
* email
* url
* length
* maxlength (`minlength:3` checks if the input string is at least 3 characters long)
* minlength (`maxlength:8` checks if the input string is at most 8 characters long)
* in (`in:joske,maria,piet` checks if the input string is equal to either `joske`, `maria` or `piet`)
* same (`same:password_confirmation` checks if the value is equal to the value of the `password_confirmation` field)
* different (`different:old_password` checks if the value is different from the value of the `old_password` field)
* lowercase (checks if the input string consists entirely of lower case characters)
* uppercase (checks if the input string consists entirely of upper case characters)
* date (checks if the input is a valid date)
* date:before (`date:before:now` checks if the input date is in the past, `date:before:1995-02-03` checks if the input date is before the 3rd of February 1995)
* date:after (`date:before:now` checks if the input date is in the past, `date:after:1995-02-03` checks if the input date is after the 3rd of February 1995)
* date:equal (`date:before:now` checks if the input date is today's date, `date:equal:1995-02-03` checks if the input date is the 3rd of February 1995)
* boolean (checks if the input is a boolean value; accepted values are true, false, 0, 1, "true", "false", "0" and "1")
* regex (tests the input value against the given regular expression)

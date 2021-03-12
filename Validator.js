const FieldValidator = require('./FieldValidator');

class Validator {
	constructor(input, rules) {
		this.valid = null;
		this.errors = [];
		this.fieldErrors = [];

		this.reverse = false;

		this.input = input;
		this.rules = rules;
	}

	validate() {
		let valid = true;
		this.errors = [];

		for (const field in this.rules) {
			const fieldValidator = new FieldValidator(field, this.input[field], this.rules[field], this.input);

			if (!fieldValidator.validate() && !this.reverse) {
				valid = false;
				this.errors.push(fieldValidator.error);
				this.fieldErrors.push
				(
					{
						field: field,
						error: fieldValidator.fieldError
					}
				);
			} else if (this.reverse && fieldValidator.validate()) { // This is pretty much just here for testing //
				valid = false;
				this.errors.push(field + ' is valid');
				this.fieldErrors.push
				(
					{
						field: field,
						error: 'Is valid'
					}
				);
			}
		}

		this.valid = valid;

		return valid;
	}
}

Validator.FieldValidator = FieldValidator;

module.exports = Validator;

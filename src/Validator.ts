import FieldValidator = require('./FieldValidator');
import type * as types from './types';

class Validator<TInput extends object = types.ValidationInput> {
	valid: boolean | null;
	errors: string[];
	fieldErrors: types.FieldError[];

	reverse: boolean;

	input: TInput;
	rules: types.ValidationRules;

	static readonly FieldValidator = FieldValidator;

	constructor(input: TInput, rules: types.ValidationRules) {
		this.valid = null;
		this.errors = [];
		this.fieldErrors = [];

		this.reverse = false;

		this.input = input;
		this.rules = rules;
	}

	validate(): boolean {
		let valid = true;
		this.errors = [];

		for (const field in this.rules) {
			const fieldValidator = new FieldValidator(field, (this.input as types.ValidationInput)[field], this.rules[field], this.input);

			if (!fieldValidator.validate() && !this.reverse) {
				valid = false;
				this.errors.push(fieldValidator.error as string);
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

export = Validator;

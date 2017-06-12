let FieldValidator = require ('./FieldValidator');

module.exports = class Validator
{
	constructor (input, rules)
	{
		this.valid = null;
		this.errors = [];
		
		this.input = input;
		this.rules = rules;
	}
	
	validate ()
	{
		let valid = true;
		this.errors = [];
		
		for (let field in this.rules)
		{
			let fieldValidator = new FieldValidator (field, this.input[field], this.rules[field], this.input);
			if (! fieldValidator.validate ())
			{
				valid = false;
				this.errors.push (fieldValidator.error);
			}
		}
		
		this.valid = valid;
		
		return valid;
	}
	
	static FieldValidator ()
	{
		return FieldValidator;
	}
}

module.exports = class FieldValidator
{
	constructor (name, value, rules, input)
	{
		this.valid = null;
		this.error = null;
		
		this.name = name;
		this.value = value;
		this.rules = rules;
		this.input = input;
		
		if (this.rules.constructor !== Array)
			this.rules = [ this.rules ];
	}
	
	validate ()
	{
		for (let rule of this.rules)
		{
			let parts = rule.split (':');
			let name = parts[0];
			
			switch (name)
			{
				case 'array':
					if (this.value.constructor === Array)
					{
						if (this.rules.includes ('required') && this.value.length === 0)
							this.invalid (this.name + ' must not be empty');
						
						let itemRules = this.rules.splice (this.rules.indexOf ('array'), 1);
						for (let i = 0; i < this.value.length; i++)
						{
							let itemValidator = new FieldValidator (this.name + '.' + i, this.value[i], itemRules);
							if (! itemValidator.validate ())
								return this.invalid (itemValidator.error);
						}
					}
					else
					{
						return this.invalid (this.name + ' must be an array');
					}
					
					break;
				case 'required':
					if (this.value === null || this.value === undefined || this.value === '')
						return this.invalid (this.name + ' is required');
					
					break;
			}
			
			if (this.rules.includes ('array') && this.rules.constructor === Array)
				break; // Rules after this are only meant for the items inside the array //
			else if (this.rules.includes ('optional') && (this.value === null || this.value === undefined))
				break; // Value is optional and not present //
			
			switch (name)
			{
				case 'int':
				case 'integer':
					if (! Number.isInteger (this.value))
						return this.invalid (this.name + ' must be an integer');
					
					break;
				case 'number':
					if (isNaN (this.value))
						return this.invalid (this.name + ' must be a number');
					
					break;
				case 'email':
					if (! /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/i.test (this.value))
						return this.invalid (this.name + ' must be a valid e-mail address');
					
					break;
				case 'url':
					if (! /^https?:\/\/[a-z0-9$\-_\+\!\*\'\(\),]+.[a-z0-9$\-_\+\!\*\'\(\),\.]+(\/[^\s]+)?$/i.test (this.value))
						return this.invalid (this.name + ' must be a valid URL');
					
					break;
				case 'length':
					if (this.value.length !== parts[1])
						return this.invalid (this.name + ' must be ' + parts[1] + ' characters long');
					
					break;
				case 'maxlength':
					if (this.value.length > parts[1])
						return this.invalid (this.name + ' must be no more than ' + parts[1] + ' characters long');
					
					break;
				case 'minlength':
					if (this.value.length < parts[1])
						return this.invalid (this.name + ' must be at least ' + parts[1] + ' characters long');
					
					break;
				case 'in':
					let options = parts[1].split (',');
					if (! options.includes (this.value))
						return this.invalid (this.name + ' must be one of the following values: ' + options.join (', '));
					
					break;
				case 'same':
				{
					let otherFields = parts[1].split (',');
					for (let otherField of otherFields)
					{
						if (this.input[otherField] !== this.value)
							return this.invalid (this.name + ' must be the same as ' + otherFields.join (', '));
					}
					
					break;
				}
				case 'different':
				{ // let doesn't really behave the way I'd expect here, so I ended up scoping the `same` and `different` validators // SyntaxError: Identifier 'otherFields' has already been declared //
					let otherFields = parts[1].split (',');
					let values = [this.value];
					for (let otherField of otherFields)
					{
						if (values.includes (this.input[otherField]))
							return this.invalid (this.name + ' must be different from ' + otherFields.join (', '));
						else
							values.push (this.input[otherField]);
					}
					
					break;
				}
				case 'lowercase':
					if (this.value !== this.value.toLowerCase ())
						return this.invalid (this.name + ' must be lower case');
					
					break;
				case 'uppercase':
					if (this.value !== this.value.toUpperCase ())
						return this.invalid (this.name + ' must be upper case');
					
					break;
				case 'date':
					if (! /^(\d{1,4})\-((0?[1-9])|(1[0-2]))\-(([012]?[0-9])|(3[01]))$/.test (this.value))
						return this.invalid (this.name + ' must be a valid date');
					
					let date = new Date (this.value);
					
					if (parts[1])
					{
						let date2 = parts[2] === 'now' ? (new Date ()).setHours (0, 0, 0, 0) : new Date (parts[2]);
						
						switch (parts[1])
						{
							case 'before':
								if (date >= date2)
									return this.invalid (this.name + ' must be a date before ' + date2.toLocaleDateString ());
								
								break;
							case 'after':
								if (date < date2)
									return this.invalid (this.name + ' must be a date after ' + date2.toLocaleDateString ());
								
								break;
							case 'equal':
								if (date.valueOf () !== date2.valueOf ())
									return this.invalid (this.name + ' must be ' + date2.toLocaleDateString ());
								
								break;
						}
					}
					
					break;
				case 'bool':
				case 'boolean':
					if (! [true, false, 0, 1, 'true', 'false', '0', '1'].includes (this.value))
						return this.invalid (this.name + ' must be a boolean value (true or false)');
					
					break;
				case 'regex':
					let regex = new RegExp (rule.substr (rule.split (':', 1)[0].length + 1));
					if (! regex.test (this.value))
						return this.invalid (this.name + ' must match the following regular expression: ' + regex);
					
					break;
			}
		}
		
		this.error = null;
		this.valid = true;
		
		return true;
	}
	
	invalid (message)
	{
		this.valid = false;
		this.error = message;
		
		return false;
	}
}
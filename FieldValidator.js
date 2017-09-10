module.exports = class FieldValidator
{
	constructor (name, value, rules, input)
	{
		this.valid = null;
		this.fieldError = null;
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
							this.invalid (this.name, 'must not be empty');
						
						let itemRules = this.rules.splice (this.rules.indexOf ('array'), 1);
						for (let i = 0; i < this.value.length; i++)
						{
							let itemValidator = new FieldValidator (this.name + '.' + i, this.value[i], itemRules);
							if (! itemValidator.validate ())
								return this.invalid (this.name, itemValidator.fieldError);
						}
					}
					else
					{
						return this.invalid (this.name, 'must be an array');
					}
					
					break;
				case 'required':
					if (this.value === null || this.value === undefined || this.value === '')
						return this.invalid (this.name, 'is required');
					
					break;
			}
			
			if (this.rules.includes ('array') && this.rules.constructor === Array)
				break; // Rules after this are only meant for the items inside the array //
			else if (this.rules.includes ('optional') && (this.value === null || this.value === undefined))
				break; // Value is optional and not present //
			
			let value = this.value; // Let's make a copy to manipulate //
			
			switch (name)
			{
				case 'int':
				case 'integer':
					if (! (Number.isInteger (value) || ((value.constructor.name === 'String' && String (parseInt (value)) === value))))
						return this.invalid (this.name, 'must be an integer');
					
					break;
				case 'number':
					if (value.constructor.name === 'String')
					{
						value = Number (value);
						
						if (String (value) !== this.value)
							return this.invalid (this.name, 'must be a number');
					}
					
					if (value.constructor.name !== 'Number' || isNaN (value))
						return this.invalid (this.name, 'must be a number');
					
					break;
				case 'string':
					if (value.constructor.name !== 'String')
						return this.invalid (this.name, 'must be a string');
					
					break;
				case 'email':
					this.rules.push ('string');
					if (! /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/i.test (value))
						return this.invalid (this.name, 'must be a valid e-mail address');
					
					break;
				case 'url':
					this.rules.push ('string');
					if (! /^https?:\/\/[a-z0-9$\-_\+\!\*\'\(\),]+.[a-z0-9$\-_\+\!\*\'\(\),\.]+\.[a-z0-9]+(\/[^\s]*)?$/i.test (value))
						return this.invalid (this.name, 'must be a valid URL');
					
					break;
				case 'length':
					if (value.constructor.name === 'Number')
						value = String (value);
					
					if (value.length !== parseInt (parts[1]))
						return this.invalid (this.name, 'must be ' + parts[1] + ' characters long');
					
					break;
				case 'maxlength':
					if (value.constructor.name === 'Number')
						value = String (value);
					
					if (isNaN (value.length) || value.length > parseInt (parts[1]))
						return this.invalid (this.name, 'must be no more than ' + parts[1] + ' characters long');
					
					break;
				case 'minlength':
					if (value.constructor.name === 'Number')
						value = String (value);
					
					if (isNaN (value.length) || value.length < parseInt (parts[1]))
						return this.invalid (this.name, 'must be at least ' + parts[1] + ' characters long');
					
					break;
				case 'in':
					let options = parts[1].split (',');
					if (['Number', 'Boolean'].includes (value.constructor.name))
						value = String (value);
					
					if (! options.includes (value))
						return this.invalid (this.name, 'must be one of the following values: ' + options.join (', '));
					
					break;
				case 'same':
				{ // to prevent otherFields from being hoisted up too far //
					let otherFields = parts[1].split (',');
					for (let otherField of otherFields)
					{
						if (this.input[otherField] !== value)
							return this.invalid (this.name, 'must be the same as ' + otherFields.join (', '));
					}
					
					break;
				}
				case 'different':
				{
					let otherFields = parts[1].split (',');
					let values = [value];
					for (let otherField of otherFields)
					{
						if (values.includes (this.input[otherField]))
							return this.invalid (this.name, 'must be different from ' + otherFields.join (', '));
						else
							values.push (this.input[otherField]);
					}
					
					break;
				}
				case 'required_with':
					if (this.input[parts[1]] && (value === null || value === undefined || value === ''))
						return this.invalid (this.name, 'is required with ' + parts[1]);
					
					break;
				case 'required_if':
					if ((this.input[parts[1]] == parts[2]) && (value === null || value === undefined || value === ''))
						return this.invalid (this.name, 'is required if ' + parts[1] + ' is ' + parts[2]);
					
					break;
				case 'lowercase':
					this.rules.push ('string');
					value = String (value);
					if (value !== value.toLowerCase ())
						return this.invalid (this.name, 'must be lower case');
					
					break;
				case 'uppercase':
					this.rules.push ('string');
					value = String (value);
					if (value !== value.toUpperCase ())
						return this.invalid (this.name, 'must be upper case');
					
					break;
				case 'alpha':
					this.rules.push ('string');
					if (! /^[\pL\pM]+$/u.test (value))
						return this.invalid (this.name, 'must consist of alphabetic characters');
					
					break;
				case 'alpha_num':
					this.rules.push ('string');
					if (! /^[\pL\pM\pN]+$/u.test (value))
						return this.invalid (this.name, 'must consist of alphanumeric characters');
					
					break;
				case 'alpha_dash':
					this.rules.push ('string');
					if (! /^[\pL\pM\pN_-]+$/u.test (value))
						return this.invalid (this.name, 'must consist of alphanumeric characters, dashes and underscores');
					
					break;
				case 'date':
					if (! /^(\d{1,4})\-((0?[1-9])|(1[0-2]))\-(([012]?[0-9])|(3[01]))$/.test (value) && value.constructor.name !== 'Date')
						return this.invalid (this.name, 'must be a valid date');
					
					let date = new Date (value);
					
					if (parts[1])
					{
						let date2 = parts[2] === 'now' ? (new Date ()).setHours (0, 0, 0, 0) : new Date (parts[2]);
						
						switch (parts[1])
						{
							case 'before':
								if (date >= date2)
									return this.invalid (this.name, 'must be a date before ' + date2.toLocaleDateString ());
								
								break;
							case 'after':
								if (date < date2)
									return this.invalid (this.name, 'must be a date after ' + date2.toLocaleDateString ());
								
								break;
							case 'equal':
								if (date.valueOf () !== date2.valueOf ())
									return this.invalid (this.name, 'must be ' + date2.toLocaleDateString ());
								
								break;
						}
					}
					
					break;
				case 'bool':
				case 'boolean':
					if (! [true, false, 0, 1, 'true', 'false', '0', '1'].includes (value))
						return this.invalid (this.name, 'must be a boolean value (true or false)');
					
					break;
				case 'object':
					if (typeof value !== 'object')
						return this.invalid (this.name, 'must be an object');
					
					break;
				case 'distinct':
					let values = Object.values (this.input);
					values = values.splice (values.indexOf (value), 1);
					
					if (values.includes (value))
						return this.invalid (this.name, 'must contain a distinct value');
					
					break;
				case 'ip':
				case 'ipv4':
					this.rules.push ('string');
					if (! /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test (value))
						return this.invalid (this.name, 'must be a valid IP address');
					
					if (name == 'ipv4')
						break;
				case 'ipv6':
					this.rules.push ('string');
					if (! /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/.test (value))
						return this.invalid (this.name, 'must be a valid IP address');
					
					break;
				case 'json':
					this.rules.push ('string');
					try
					{
						JSON.parse (value);
					}
					catch (e)
					{
						return this.invalid (this.name, 'must be valid JSON data');
					}
					break;
				case 'regex':
					this.rules.push ('string');
					let regex = new RegExp (rule.substr (rule.split (':', 1)[0].length + 1));
					if (! regex.test (value))
						return this.invalid (this.name, 'must match the following regular expression: ' + regex);
					
					break;
			}
		}
		
		this.error = null;
		this.valid = true;
		
		return true;
	}
	
	invalid (fieldName, message)
	{
		this.valid = false;
		this.fieldError = message.charAt (0).toUpperCase () + message.substr (1);
		this.error = fieldName + ' ' + message;
		
		return false;
	}
}

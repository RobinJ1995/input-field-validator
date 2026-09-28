export type SimpleRule =
	| 'array'
	| 'required'
	| 'optional'
	| 'int'
	| 'integer'
	| 'number'
	| 'string'
	| 'email'
	| 'url'
	| 'lowercase'
	| 'uppercase'
	| 'alpha'
	| 'alpha_num'
	| 'alpha_dash'
	| 'date'
	| 'bool'
	| 'boolean'
	| 'object'
	| 'distinct'
	| 'ip'
	| 'ipv4'
	| 'ipv6'
	| 'json'
	| 'uuid';

export type ParameterisedRule =
	| `length:${number}`
	| `maxlength:${number}`
	| `minlength:${number}`
	| `in:${string}`
	| `same:${string}`
	| `different:${string}`
	| `required_with:${string}`
	| `required_if:${string}`
	| `date:before:${string}`
	| `date:after:${string}`
	| `date:equal:${string}`
	| `regex:${string}`;

export type Rule = SimpleRule | ParameterisedRule | (string & {});

export interface NestedRules {
	[field: string]: FieldRules;
}

export type FieldRules = Rule | NestedRules | Array<Rule | NestedRules>;

export interface ValidationRules {
	[field: string]: FieldRules;
}

export interface ValidationInput {
	[field: string]: any;
}

export interface FieldError {
	field: string;
	error: string | null;
}

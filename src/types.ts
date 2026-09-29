import type Validator = require('./Validator');

export type SimpleRule =
	| 'accepted' | 'alpha' | 'alpha_dash' | 'alpha_num' | 'array' | 'ascii' | 'bail' | 'boolean' | 'bool'
	| 'confirmed' | 'date' | 'declined' | 'distinct' | 'email' | 'exclude' | 'filled' | 'hex_color'
	| 'integer' | 'int' | 'ip' | 'ipv4' | 'ipv6' | 'json' | 'list' | 'lowercase' | 'mac_address'
	| 'missing' | 'nullable' | 'numeric' | 'present' | 'prohibited' | 'required' | 'sometimes'
	| 'string' | 'timezone' | 'ulid' | 'uppercase' | 'url' | 'uuid';

export type ParameterisedRule =
	| `accepted_if:${string}` | `after:${string}` | `after_or_equal:${string}` | `alpha:${string}`
	| `alpha_dash:${string}` | `alpha_num:${string}` | `array:${string}` | `before:${string}`
	| `before_or_equal:${string}` | `between:${string}` | `boolean:${string}` | `confirmed:${string}`
	| `contains:${string}` | `date_equals:${string}` | `date_format:${string}` | `decimal:${string}`
	| `declined_if:${string}` | `different:${string}` | `digits:${string}` | `digits_between:${string}`
	| `distinct:${string}` | `doesnt_contain:${string}` | `doesnt_end_with:${string}` | `doesnt_start_with:${string}`
	| `email:${string}` | `ends_with:${string}` | `exclude_if:${string}` | `exclude_unless:${string}`
	| `exclude_with:${string}` | `exclude_without:${string}` | `gt:${string}` | `gte:${string}` | `in:${string}`
	| `in_array:${string}` | `in_array_keys:${string}` | `integer:${string}` | `lt:${string}` | `lte:${string}`
	| `max:${string}` | `max_digits:${string}` | `min:${string}` | `min_digits:${string}` | `missing_if:${string}`
	| `missing_unless:${string}` | `missing_with:${string}` | `missing_with_all:${string}` | `multiple_of:${string}`
	| `not_in:${string}` | `not_regex:${string}` | `numeric:${string}` | `present_if:${string}`
	| `present_unless:${string}` | `present_with:${string}` | `present_with_all:${string}` | `prohibited_if:${string}`
	| `prohibited_if_accepted:${string}` | `prohibited_if_declined:${string}` | `prohibited_unless:${string}`
	| `prohibits:${string}` | `regex:${string}` | `required_array_keys:${string}` | `required_if:${string}`
	| `required_if_accepted:${string}` | `required_if_declined:${string}` | `required_unless:${string}`
	| `required_with:${string}` | `required_with_all:${string}` | `required_without:${string}`
	| `required_without_all:${string}` | `same:${string}` | `size:${string}` | `starts_with:${string}`
	| `timezone:${string}` | `url:${string}` | `uuid:${string}`;

export type RuleClosure = (attribute: string, value: any, fail: (message: string) => void, validator: Validator<any>) => void;

export type Rule = SimpleRule | ParameterisedRule | (string & {}) | RuleClosure | [string, ...string[]];

export interface NestedRules {
	[field: string]: FieldRules;
}

export type FieldRules = Rule | Rule[] | NestedRules;

export interface ValidationRules {
	[field: string]: FieldRules;
}

export interface ValidationInput {
	[field: string]: any;
}

export interface FieldError {
	field: string;
	error: string;
}

export type CustomMessages = Record<string, string | Record<string, string>>;

export type CustomAttributes = Record<string, string>;

export type ExtensionFn = (attribute: string, value: any, parameters: string[], validator: Validator<any>) => boolean;

export type ReplacerFn = (message: string, attribute: string, rule: string, parameters: string[], validator: Validator<any>) => string;

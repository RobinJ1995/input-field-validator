// Ports of Laravel's Illuminate\Validation\Concerns\ValidatesAttributes.
import {
	isNull, isString, isBool, isNumber, isInt, isArray, isStringable, isNumeric, isList, count, values, keys, keyExists,
	gettype, toStr, toNumber, trim, mbStrlen, strlen, looseEquals, strictEquals, inArray, filterVarInt, isAscii,
	pcreToRegExp, parseDecimal, compareDecimal, decimalRemainderIsZero, isZero, Decimal,
} from './php';
import { arrGet, arrHas, arrHasAny, arrDot, leadingExplicitPath, extractDataFromPath } from './data';
import { parseDate, checkdate, createFromFormat, formatDate } from './dates';
import { isEmail, isUrl, isUuid, isUlid, isIpv4, isIpv6, isMacAddress, timezoneIdentifiers } from './formats';

export type RuleSpec = string | Function | unknown[];

export interface RuleContext {
	data: Record<string, unknown>;
	rules: Record<string, RuleSpec[]>;
	numericRules: string[];
	getValue(attribute: string): unknown;
	hasRule(attribute: string, rules: string | string[]): boolean;
	getRule(attribute: string, rules: string | string[]): [string, string[]] | null;
	getPrimaryAttribute(attribute: string): string;
}

export type RuleFn = (v: RuleContext, attribute: string, value: unknown, parameters: string[]) => boolean;

export class MathError extends Error {}

export function requireParameterCount(n: number, parameters: string[], rule: string): void {
	if (parameters.length < n)
		throw new Error(`Validation rule ${rule} requires at least ${n} parameters.`);
}

const trimValue = (value: unknown): string => isString(value) ? trim(value) : toStr(value);

function ensureExponentWithinAllowedRange(value: string): string {
	const m = /[eE]([+-]?\d+)$/.exec(value);
	if (m && Math.abs(Number(m[1])) > 1000)
		throw new MathError('Scientific notation exponent outside of allowed range.');

	return value;
}

export function getSize(v: RuleContext, attribute: string, value: unknown): string | number {
	if (isNumeric(value) && v.hasRule(attribute, v.numericRules))
		return ensureExponentWithinAllowedRange(trimValue(value));
	if (isArray(value))
		return count(value);

	return mbStrlen(toStr(value));
}

// BigNumber::of() on both sides; a MathError means "not a number" and the rule fails.
function bigCompare(v: RuleContext, attribute: string, value: unknown, parameter: string): -1 | 0 | 1 {
	const size = parseDecimal(getSize(v, attribute, value));
	const other = parseDecimal(trim(parameter));
	if (!size || !other) throw new MathError('Not a number');

	return compareDecimal(size, other);
}

const guarded = (fn: () => boolean): boolean => {
	try {
		return fn();
	} catch (e) {
		if (e instanceof MathError) return false;
		throw e;
	}
};

function parseDependentRuleParameters(v: RuleContext, parameters: string[]): [unknown[], unknown] {
	const other = arrGet(v.data, parameters[0]);
	let list: unknown[] = parameters.slice(1);
	if ((v.rules[parameters[0]] ?? []).includes('boolean') || isBool(other))
		list = list.map(p => p === 'true' ? true : p === 'false' ? false : p);
	if (isNull(other))
		list = list.map(p => isString(p) && p.toLowerCase() === 'null' ? null : p);

	return [list, other];
}

const otherMatches = (v: RuleContext, parameters: string[]): boolean => {
	const [list, other] = parseDependentRuleParameters(v, parameters);

	return inArray(other, list, isBool(other) || isNull(other));
};

const anyFailingRequired = (v: RuleContext, attributes: string[]): boolean => attributes.some(a => !required(v.getValue(a)));
const allFailingRequired = (v: RuleContext, attributes: string[]): boolean => attributes.every(a => !required(v.getValue(a)));

function required(value: unknown): boolean {
	if (isNull(value)) return false;
	if (isString(value) && trim(value) === '') return false;
	if (isArray(value) && count(value) < 1) return false;

	return true;
}

const ACCEPTABLE = ['yes', 'on', '1', 1, true, 'true'];
const DECLINABLE = ['no', 'off', '0', 0, false, 'false'];

const accepted = (value: unknown): boolean => required(value) && inArray(value, ACCEPTABLE, true);
const declined = (value: unknown): boolean => required(value) && inArray(value, DECLINABLE, true);

function getDateFormat(v: RuleContext, attribute: string): string | undefined {
	return v.getRule(attribute, 'date_format')?.[1][0];
}

function getDateTime(value: unknown): number | null {
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
	if (!isString(value) && !isNumeric(value)) return null;

	return parseDate(toStr(value))?.time ?? null;
}

function getDateTimestamp(value: unknown): number | null {
	const ms = isNull(value) ? null : getDateTime(value);

	return ms === null ? null : Math.floor(ms / 1000);
}

// PHP compares null against a number as booleans.
function compare(first: number | null, second: number | null, operator: string): boolean {
	let a: number, b: number;
	if (first === null || second === null) {
		a = first ? 1 : 0;
		b = second ? 1 : 0;
	} else {
		[a, b] = [first, second];
	}
	switch (operator) {
		case '<': return a < b;
		case '>': return a > b;
		case '<=': return a <= b;
		case '>=': return a >= b;
		default: return a === b;
	}
}

function getDateTimeWithOptionalFormat(format: string, value: unknown): number | null {
	if (value instanceof Date) return getDateTime(value);
	if (!isString(value) && !isNumeric(value)) return null;

	return createFromFormat(format, toStr(value), false)?.date.getTime() ?? getDateTime(value);
}

function checkDateTimeOrder(v: RuleContext, format: string, first: unknown, second: string, operator: string): boolean {
	const firstDate = getDateTimeWithOptionalFormat(format, first);
	format = getDateFormat(v, second) ?? format;
	let secondDate = getDateTimeWithOptionalFormat(format, second);
	if (secondDate === null) {
		const secondValue = v.getValue(second);
		if (isNull(secondValue)) return true;
		secondDate = getDateTimeWithOptionalFormat(format, secondValue);
	}

	return firstDate !== null && secondDate !== null && compare(firstDate, secondDate, operator);
}

function compareDates(v: RuleContext, attribute: string, value: unknown, parameters: string[], operator: string): boolean {
	if (!isString(value) && !isNumeric(value) && !(value instanceof Date)) return false;

	const format = getDateFormat(v, attribute);
	if (format) return checkDateTimeOrder(v, format, value, parameters[0], operator);

	let date = getDateTimestamp(parameters[0]);
	if (date === null) date = getDateTimestamp(v.getValue(parameters[0]));

	return compare(getDateTimestamp(value), date, operator);
}

const dateRule = (name: string, operator: string): RuleFn => (v, attribute, value, parameters) => {
	requireParameterCount(1, parameters, name);

	return compareDates(v, attribute, value, parameters, operator);
};

// Str::is() for a single wildcard pattern.
const strIs = (pattern: string, value: string): boolean =>
	pattern === value || new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')}$`, 'u').test(value);

function extractDistinctValues(v: RuleContext, attribute: string): Record<string, unknown> {
	const attributeData = extractDataFromPath(leadingExplicitPath(attribute), v.data);
	const pattern = new RegExp(`^${attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '[^.]+')}$`, 'u');
	const results: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(arrDot(attributeData)))
		if (pattern.test(key)) results[key] = value;

	return results;
}

const digitsOnly = (value: unknown): boolean => !isArray(value) && !/[^0-9]/.test(toStr(value));

const comparisonRule = (name: string, cmp: (a: number) => boolean): RuleFn => (v, attribute, value, parameters) => {
	requireParameterCount(1, parameters, name);
	const comparedTo = v.getValue(parameters[0]);
	if (isNumeric(v.getValue(attribute)))
		v.numericRules.push(name);

	if (isNull(comparedTo) && isNumeric(value) && isNumeric(parameters[0]))
		return guarded(() => cmp(bigCompare(v, attribute, value, parameters[0])));
	if (isNumeric(parameters[0]))
		return false;
	if (v.hasRule(attribute, v.numericRules) && isNumeric(value) && isNumeric(comparedTo)) {
		const a = parseDecimal(trimValue(value)), b = parseDecimal(trimValue(comparedTo));

		return a !== null && b !== null && cmp(compareDecimal(a, b));
	}
	if (gettype(value) !== gettype(comparedTo))
		return false;

	return guarded(() => {
		const a = toNumber(getSize(v, attribute, value)), b = toNumber(getSize(v, attribute, comparedTo));

		return cmp(a < b ? -1 : a > b ? 1 : 0);
	});
};

const stringHaystack = (value: unknown): string | null => isNull(value) || isArray(value) ? null : toStr(value);

const startsWith = (value: unknown, needles: string[]): boolean => {
	const haystack = stringHaystack(value);

	return haystack !== null && needles.some(n => n !== '' && haystack.startsWith(n));
};

const endsWith = (value: unknown, needles: string[]): boolean => {
	const haystack = stringHaystack(value);

	return haystack !== null && needles.some(n => n !== '' && haystack.endsWith(n));
};

const unsupported = (name: string, why: string): RuleFn => () => {
	throw new Error(`The ${name} rule is not supported: ${why}.`);
};

// There are no uploaded files in JS, so Laravel's file rules can never pass.
const fileRule: RuleFn = () => false;

const rules: Record<string, RuleFn> = {
	accepted: (_v, _a, value) => accepted(value),

	accepted_if: (v, _a, value, parameters) => {
		requireParameterCount(2, parameters, 'accepted_if');

		return otherMatches(v, parameters) ? accepted(value) : true;
	},

	declined: (_v, _a, value) => declined(value),

	declined_if: (v, _a, value, parameters) => {
		requireParameterCount(2, parameters, 'declined_if');

		return otherMatches(v, parameters) ? declined(value) : true;
	},

	active_url: unsupported('active_url', 'it needs a DNS lookup'),

	ascii: (_v, _a, value) => isAscii(toStr(value)),

	bail: () => true,

	before: dateRule('before', '<'),
	before_or_equal: dateRule('before_or_equal', '<='),
	after: dateRule('after', '>'),
	after_or_equal: dateRule('after_or_equal', '>='),
	date_equals: dateRule('date_equals', '='),

	alpha: (_v, _a, value, parameters) => {
		if (parameters[0] === 'ascii') return isString(value) && /^[a-zA-Z]+$/.test(value);

		return isString(value) && /^[\p{L}\p{M}]+$/u.test(value);
	},

	alpha_dash: (_v, _a, value, parameters) => {
		if (!isString(value) && !isNumeric(value)) return false;
		if (parameters[0] === 'ascii') return /^[a-zA-Z0-9_-]+$/.test(toStr(value));

		return /^[\p{L}\p{M}\p{N}_-]+$/u.test(toStr(value));
	},

	alpha_num: (_v, _a, value, parameters) => {
		if (!isString(value) && !isNumeric(value)) return false;
		if (parameters[0] === 'ascii') return /^[a-zA-Z0-9]+$/.test(toStr(value));

		return /^[\p{L}\p{M}\p{N}]+$/u.test(toStr(value));
	},

	array: (_v, _a, value, parameters) => {
		if (!isArray(value)) return false;
		if (parameters.length === 0) return true;

		return keys(value).every(k => parameters.includes(k));
	},

	list: (_v, _a, value) => isArray(value) && isList(value),

	required_array_keys: (_v, _a, value, parameters) => isArray(value) && parameters.every(p => keyExists(value, p)),

	between: (v, attribute, value, parameters) => {
		requireParameterCount(2, parameters, 'between');

		return guarded(() => bigCompare(v, attribute, value, parameters[0]) >= 0 && bigCompare(v, attribute, value, parameters[1]) <= 0);
	},

	boolean: (_v, _a, value, parameters) =>
		inArray(value, parameters[0] === 'strict' ? [true, false] : [true, false, 0, 1, '0', '1'], true),

	confirmed: (v, attribute, value, parameters) => rules.same(v, attribute, value, [parameters[0] ?? `${attribute}_confirmation`]),

	contains: (_v, _a, value, parameters) => isArray(value) && parameters.every(p => inArray(p, values(value))),

	doesnt_contain: (_v, _a, value, parameters) => isArray(value) && !parameters.some(p => inArray(p, values(value))),

	current_password: unsupported('current_password', 'there is no authenticated user'),

	date: (_v, _a, value) => {
		if (value instanceof Date) return !Number.isNaN(value.getTime());
		if (!isString(value) && !isNumeric(value)) return false;

		const parsed = parseDate(toStr(value));

		return parsed !== null && parsed.y !== undefined && parsed.m !== undefined && parsed.d !== undefined
			&& checkdate(parsed.m, parsed.d, parsed.y);
	},

	date_format: (_v, _a, value, parameters) => {
		requireParameterCount(1, parameters, 'date_format');
		if (!isString(value) && !isNumeric(value)) return false;

		return parameters.some(format => {
			const date = createFromFormat(format, toStr(value), true);

			return date !== null && looseEquals(formatDate(format, date), value);
		});
	},

	decimal: (v, attribute, value, parameters) => {
		requireParameterCount(1, parameters, 'decimal');
		if (!rules.numeric(v, attribute, value, [])) return false;

		const m = /^[+-]?\d*\.?(\d*)$/.exec(toStr(value));
		if (!m) return false;

		const decimals = m[1].length;
		if (parameters[1] === undefined) return decimals === Number(parameters[0]);

		return decimals >= Number(parameters[0]) && decimals <= Number(parameters[1]);
	},

	different: (v, _a, value, parameters) => {
		requireParameterCount(1, parameters, 'different');

		return parameters.every(p => !arrHas(v.data, p) || !strictEquals(value, arrGet(v.data, p)));
	},

	digits: (_v, _a, value, parameters) => {
		requireParameterCount(1, parameters, 'digits');

		return (isNumeric(value) || isString(value)) && digitsOnly(value) && strlen(toStr(value)) === Number(parameters[0]);
	},

	digits_between: (_v, _a, value, parameters) => {
		requireParameterCount(2, parameters, 'digits_between');
		const length = strlen(toStr(value));

		return digitsOnly(value) && length >= Number(parameters[0]) && length <= Number(parameters[1]);
	},

	dimensions: fileRule,

	distinct: (v, attribute, value, parameters) => {
		const data = extractDistinctValues(v, v.getPrimaryAttribute(attribute));
		delete data[attribute];
		const others = Object.values(data);

		if (parameters.includes('ignore_case')) {
			const pattern = new RegExp(`^${toStr(value).replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')}$`, 'iu');

			return !others.some(o => pattern.test(toStr(o)));
		}

		return !inArray(value, others, parameters.includes('strict'));
	},

	email: (_v, _a, value, parameters) => {
		if (!isString(value) && !isStringable(value)) return false;
		if (/[\r\n]/.test(toStr(value))) return false;

		return isEmail(toStr(value), parameters);
	},

	encoding: unsupported('encoding', 'JS strings have no byte encoding'),
	exists: unsupported('exists', 'there is no database'),
	unique: unsupported('unique', 'there is no database'),
	extensions: fileRule,
	file: fileRule,
	image: fileRule,
	mimes: fileRule,
	mimetypes: fileRule,
	enum: unsupported('enum', 'JS has no enums'),

	filled: (v, attribute, value) => arrHas(v.data, attribute) ? required(value) : true,

	gt: comparisonRule('gt', c => c > 0),
	lt: comparisonRule('lt', c => c < 0),
	gte: comparisonRule('gte', c => c >= 0),
	lte: comparisonRule('lte', c => c <= 0),

	lowercase: (_v, _a, value) => isString(value) && value.toLowerCase() === value,

	uppercase: (_v, _a, value) => isString(value) && value.toUpperCase() === value,

	hex_color: (_v, _a, value) => !isArray(value) && /^#(?:(?:[0-9a-f]{3}){1,2}|(?:[0-9a-f]{4}){1,2})$/i.test(toStr(value)),

	in: (v, attribute, value, parameters) => {
		if (isArray(value) && v.hasRule(attribute, 'array')) {
			const items = values(value);
			if (items.some(isArray)) return false;

			return items.every(item => parameters.some(p => toStr(item) === toStr(p)));
		}

		return !isArray(value) && inArray(toStr(value), parameters, true);
	},

	in_array: (v, _a, value, parameters) => {
		requireParameterCount(1, parameters, 'in_array');
		const attributeData = extractDataFromPath(leadingExplicitPath(parameters[0]), v.data);
		const others = Object.entries(arrDot(attributeData)).filter(([key]) => strIs(parameters[0], key)).map(([, val]) => val);

		return inArray(value, others);
	},

	in_array_keys: (_v, _a, value, parameters) =>
		isArray(value) && parameters.length > 0 && parameters.some(p => keyExists(value, p)),

	integer: (_v, _a, value, parameters) => parameters[0] === 'strict' ? isInt(value) : filterVarInt(value) !== false,

	ip: (_v, _a, value) => isString(value) && (isIpv4(value) || isIpv6(value)),
	ipv4: (_v, _a, value) => isString(value) && isIpv4(value),
	ipv6: (_v, _a, value) => isString(value) && isIpv6(value),
	mac_address: (_v, _a, value) => isString(value) && isMacAddress(value),

	json: (_v, _a, value) => {
		if (isArray(value) || isNull(value)) return false;
		if (!isString(value) && !isNumber(value) && !isBool(value) && !isStringable(value)) return false;
		try {
			JSON.parse(toStr(value));

			return true;
		} catch {
			return false;
		}
	},

	max: (v, attribute, value, parameters) => {
		requireParameterCount(1, parameters, 'max');

		return guarded(() => bigCompare(v, attribute, value, parameters[0]) <= 0);
	},

	min: (v, attribute, value, parameters) => {
		requireParameterCount(1, parameters, 'min');

		return guarded(() => bigCompare(v, attribute, value, parameters[0]) >= 0);
	},

	size: (v, attribute, value, parameters) => {
		requireParameterCount(1, parameters, 'size');

		return guarded(() => bigCompare(v, attribute, value, parameters[0]) === 0);
	},

	max_digits: (_v, _a, value, parameters) => {
		requireParameterCount(1, parameters, 'max_digits');

		return digitsOnly(value) && strlen(toStr(value)) <= Number(parameters[0]);
	},

	min_digits: (_v, _a, value, parameters) => {
		requireParameterCount(1, parameters, 'min_digits');

		return digitsOnly(value) && strlen(toStr(value)) >= Number(parameters[0]);
	},

	missing: (v, attribute) => !arrHas(v.data, attribute),

	missing_if: (v, attribute, value, parameters) => {
		requireParameterCount(2, parameters, 'missing_if');

		return otherMatches(v, parameters) ? rules.missing(v, attribute, value, parameters) : true;
	},

	missing_unless: (v, attribute, value, parameters) => {
		requireParameterCount(2, parameters, 'missing_unless');

		return otherMatches(v, parameters) ? true : rules.missing(v, attribute, value, parameters);
	},

	missing_with: (v, attribute, value, parameters) => {
		requireParameterCount(1, parameters, 'missing_with');

		return arrHasAny(v.data, parameters) ? rules.missing(v, attribute, value, parameters) : true;
	},

	missing_with_all: (v, attribute, value, parameters) => {
		requireParameterCount(1, parameters, 'missing_with_all');

		return arrHas(v.data, parameters) ? rules.missing(v, attribute, value, parameters) : true;
	},

	multiple_of: (v, attribute, value, parameters) => {
		requireParameterCount(1, parameters, 'multiple_of');
		if (!rules.numeric(v, attribute, value, []) || !rules.numeric(v, attribute, parameters[0], [])) return false;

		const numerator = parseDecimal(trimValue(value)) as Decimal;
		const denominator = parseDecimal(trimValue(parameters[0])) as Decimal;
		if (isZero(numerator) && isZero(denominator)) return false;
		if (isZero(numerator)) return true;
		if (isZero(denominator)) return false;

		return decimalRemainderIsZero(numerator, denominator);
	},

	nullable: () => true,

	not_in: (v, attribute, value, parameters) => !rules.in(v, attribute, value, parameters),

	numeric: (_v, _a, value, parameters) => {
		if (parameters[0] === 'strict' && isString(value)) return false;

		return isNumeric(value);
	},

	present: (v, attribute) => arrHas(v.data, attribute),

	present_if: (v, attribute, value, parameters) => {
		requireParameterCount(2, parameters, 'present_if');

		return otherMatches(v, parameters) ? rules.present(v, attribute, value, parameters) : true;
	},

	present_unless: (v, attribute, value, parameters) => {
		requireParameterCount(2, parameters, 'present_unless');

		return otherMatches(v, parameters) ? true : rules.present(v, attribute, value, parameters);
	},

	present_with: (v, attribute, value, parameters) => {
		requireParameterCount(1, parameters, 'present_with');

		return arrHasAny(v.data, parameters) ? rules.present(v, attribute, value, parameters) : true;
	},

	present_with_all: (v, attribute, value, parameters) => {
		requireParameterCount(1, parameters, 'present_with_all');

		return arrHas(v.data, parameters) ? rules.present(v, attribute, value, parameters) : true;
	},

	regex: (_v, _a, value, parameters) => {
		if (!isString(value) && !isNumeric(value)) return false;
		requireParameterCount(1, parameters, 'regex');

		return pcreToRegExp(parameters[0]).test(toStr(value));
	},

	not_regex: (_v, _a, value, parameters) => {
		if (!isString(value) && !isNumeric(value)) return false;
		requireParameterCount(1, parameters, 'not_regex');

		return !pcreToRegExp(parameters[0]).test(toStr(value));
	},

	required: (_v, _a, value) => required(value),

	required_if: (v, _a, value, parameters) => {
		requireParameterCount(2, parameters, 'required_if');
		if (!arrHas(v.data, parameters[0])) return true;

		return otherMatches(v, parameters) ? required(value) : true;
	},

	required_if_accepted: (v, _a, value, parameters) => {
		requireParameterCount(1, parameters, 'required_if_accepted');

		return accepted(v.getValue(parameters[0])) ? required(value) : true;
	},

	required_if_declined: (v, _a, value, parameters) => {
		requireParameterCount(1, parameters, 'required_if_declined');

		return declined(v.getValue(parameters[0])) ? required(value) : true;
	},

	prohibited: (_v, _a, value) => !required(value),

	prohibited_if: (v, _a, value, parameters) => {
		requireParameterCount(2, parameters, 'prohibited_if');

		return otherMatches(v, parameters) ? !required(value) : true;
	},

	prohibited_if_accepted: (v, _a, value, parameters) => {
		requireParameterCount(1, parameters, 'prohibited_if_accepted');

		return accepted(v.getValue(parameters[0])) ? !required(value) : true;
	},

	prohibited_if_declined: (v, _a, value, parameters) => {
		requireParameterCount(1, parameters, 'prohibited_if_declined');

		return declined(v.getValue(parameters[0])) ? !required(value) : true;
	},

	prohibited_unless: (v, _a, value, parameters) => {
		requireParameterCount(2, parameters, 'prohibited_unless');

		return otherMatches(v, parameters) ? true : !required(value);
	},

	prohibits: (v, _a, value, parameters) =>
		!required(value) || !parameters.some(p => required(arrGet(v.data, p))),

	exclude: () => false,

	exclude_if: (v, _a, _value, parameters) => {
		requireParameterCount(2, parameters, 'exclude_if');
		if (!arrHas(v.data, parameters[0])) return true;

		return !otherMatches(v, parameters);
	},

	exclude_unless: (v, _a, _value, parameters) => {
		requireParameterCount(2, parameters, 'exclude_unless');

		return otherMatches(v, parameters);
	},

	exclude_with: (v, _a, _value, parameters) => {
		requireParameterCount(1, parameters, 'exclude_with');

		return !arrHas(v.data, parameters[0]);
	},

	exclude_without: (v, _a, _value, parameters) => {
		requireParameterCount(1, parameters, 'exclude_without');

		return !anyFailingRequired(v, parameters);
	},

	required_unless: (v, _a, value, parameters) => {
		requireParameterCount(2, parameters, 'required_unless');

		return otherMatches(v, parameters) ? true : required(value);
	},

	required_with: (v, _a, value, parameters) => allFailingRequired(v, parameters) ? true : required(value),
	required_with_all: (v, _a, value, parameters) => anyFailingRequired(v, parameters) ? true : required(value),
	required_without: (v, _a, value, parameters) => anyFailingRequired(v, parameters) ? required(value) : true,
	required_without_all: (v, _a, value, parameters) => allFailingRequired(v, parameters) ? required(value) : true,

	same: (v, _a, value, parameters) => {
		requireParameterCount(1, parameters, 'same');

		return strictEquals(value, arrGet(v.data, parameters[0]));
	},

	sometimes: () => true,

	starts_with: (_v, _a, value, parameters) => startsWith(value, parameters),
	doesnt_start_with: (_v, _a, value, parameters) => !startsWith(value, parameters),
	ends_with: (_v, _a, value, parameters) => endsWith(value, parameters),
	doesnt_end_with: (_v, _a, value, parameters) => !endsWith(value, parameters),

	string: (_v, _a, value) => isString(value),

	timezone: (_v, _a, value, parameters) =>
		isString(value) && timezoneIdentifiers((parameters[0] ?? 'ALL').toUpperCase(), parameters[1]?.toUpperCase()).includes(value),

	url: (_v, _a, value, parameters) => isString(value) && isUrl(value, parameters),

	ulid: (_v, _a, value) => isString(value) && isUlid(value),

	uuid: (_v, _a, value, parameters) => {
		let version: number | 'max' | null = null;
		if (parameters.length === 1)
			version = parameters[0] === 'max' ? 'max' : parseInt(parameters[0], 10) || 0;

		return isString(value) && isUuid(value, version);
	},
};

export default rules;

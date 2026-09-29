// Ports of Laravel's Illuminate\Validation\Concerns\ReplacesAttributes.
import { ucfirst } from './php';
import { arrGet } from './data';
import { parseDate } from './dates';

export interface ReplacerContext {
	data: Record<string, unknown>;
	getValue(attribute: string): unknown;
	getDisplayableAttribute(attribute: string): string;
	getDisplayableValue(attribute: string, value: unknown): string;
	getSize(attribute: string, value: unknown): string | number;
}

export type Replacer = (v: ReplacerContext, message: string, attribute: string, rule: string, parameters: string[]) => string;

const replaceAll = (message: string, search: string, replacement: string): string => message.split(search).join(replacement);

function replaceWhileKeepingCase(message: string, mapping: Record<string, string>): string {
	for (const [placeholder, value] of Object.entries(mapping)) {
		message = replaceAll(message, `:${placeholder}`, value);
		message = replaceAll(message, `:${placeholder.toUpperCase()}`, value.toUpperCase());
		message = replaceAll(message, `:${ucfirst(placeholder)}`, ucfirst(value));
	}

	return message;
}

const attributeList = (v: ReplacerContext, parameters: string[]): string[] => parameters.map(p => v.getDisplayableAttribute(p));

const otherAndValue: Replacer = (v, message, _a, _r, parameters) => replaceWhileKeepingCase(message, {
	other: v.getDisplayableAttribute(parameters[0]),
	value: v.getDisplayableValue(parameters[0], arrGet(v.data, parameters[0])),
});

const otherAndGivenValue: Replacer = (v, message, _a, _r, parameters) =>
	replaceAll(replaceAll(message, ':other', v.getDisplayableAttribute(parameters[0])), ':value', v.getDisplayableValue(parameters[0], parameters[1]));

const attributeValues: Replacer = (v, message, _a, _r, parameters) =>
	replaceWhileKeepingCase(message, { values: attributeList(v, parameters).join(' / ') });

const displayableValues: Replacer = (v, message, attribute, _r, parameters) =>
	replaceWhileKeepingCase(message, { values: parameters.map(p => v.getDisplayableValue(attribute, p)).join(', ') });

const other: Replacer = (v, message, _a, _r, parameters) =>
	replaceWhileKeepingCase(message, { other: v.getDisplayableAttribute(parameters[0]) });

const otherInValues: Replacer = (v, message, _a, _r, parameters) => replaceWhileKeepingCase(message, {
	other: v.getDisplayableAttribute(parameters[0]),
	values: parameters.slice(1).map(p => v.getDisplayableValue(parameters[0], p)).join(', '),
});

const minMax: Replacer = (_v, message, _a, _r, parameters) =>
	replaceAll(replaceAll(message, ':min', parameters[0]), ':max', parameters[1]);

const size: Replacer = (v, message, attribute, _r, parameters) => {
	const value = v.getValue(parameters[0]);
	if (value === null || value === undefined)
		return replaceAll(message, ':value', v.getDisplayableAttribute(parameters[0]));

	return replaceAll(message, ':value', String(v.getSize(attribute, value)));
};

const date: Replacer = (v, message, attribute, _r, parameters) => {
	const parsed = parseDate(parameters[0]);
	if (!parsed || parsed.time === 0)
		return replaceAll(message, ':date', v.getDisplayableAttribute(parameters[0]));

	return replaceAll(message, ':date', v.getDisplayableValue(attribute, parameters[0]));
};

const joined = (placeholder: string): Replacer => (_v, message, _a, _r, parameters) => replaceAll(message, placeholder, parameters.join(', '));

const replacers: Record<string, Replacer> = {
	accepted_if: otherAndValue,
	declined_if: otherAndValue,
	between: minMax,
	date_format: (_v, message, _a, _r, parameters) => replaceAll(message, ':format', parameters[0]),
	decimal: (_v, message, _a, _r, parameters) =>
		replaceAll(message, ':decimal', parameters[1] !== undefined ? `${parameters[0]}-${parameters[1]}` : parameters[0]),
	different: other,
	digits: (_v, message, _a, _r, parameters) => replaceAll(message, ':digits', parameters[0]),
	digits_between: minMax,
	encoding: (_v, message, _a, _r, parameters) => replaceAll(message, ':encoding', parameters[0]),
	extensions: joined(':values'),
	min: (_v, message, _a, _r, parameters) => replaceAll(message, ':min', parameters[0]),
	min_digits: (_v, message, _a, _r, parameters) => replaceAll(message, ':min', parameters[0]),
	max: (_v, message, _a, _r, parameters) => replaceAll(message, ':max', parameters[0]),
	max_digits: (_v, message, _a, _r, parameters) => replaceAll(message, ':max', parameters[0]),
	missing_if: otherAndValue,
	missing_unless: otherAndGivenValue,
	missing_with: attributeValues,
	missing_with_all: attributeValues,
	multiple_of: (_v, message, _a, _r, parameters) => replaceAll(message, ':value', parameters[0] ?? ''),
	in: displayableValues,
	not_in: displayableValues,
	in_array: other,
	in_array_keys: displayableValues,
	required_array_keys: displayableValues,
	mimetypes: joined(':values'),
	mimes: joined(':values'),
	present_if: otherAndValue,
	present_unless: otherAndGivenValue,
	present_with: attributeValues,
	present_with_all: attributeValues,
	required_with: attributeValues,
	required_with_all: attributeValues,
	required_without: attributeValues,
	required_without_all: attributeValues,
	size: (_v, message, _a, _r, parameters) => replaceAll(message, ':size', parameters[0]),
	gt: size,
	lt: size,
	gte: size,
	lte: size,
	required_if: otherAndValue,
	required_if_accepted: other,
	required_if_declined: other,
	required_unless: otherInValues,
	prohibited_if: otherAndValue,
	prohibited_if_accepted: other,
	prohibited_if_declined: other,
	prohibited_unless: otherInValues,
	prohibits: (v, message, _a, _r, parameters) => replaceWhileKeepingCase(message, { other: attributeList(v, parameters).join(' / ') }),
	same: other,
	before: date,
	before_or_equal: date,
	after: date,
	after_or_equal: date,
	date_equals: date,
	ends_with: displayableValues,
	doesnt_end_with: displayableValues,
	starts_with: displayableValues,
	doesnt_start_with: displayableValues,
	doesnt_contain: displayableValues,
};

export default replacers;

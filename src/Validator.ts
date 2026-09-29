// Port of Illuminate\Validation\Validator with the original `new Validator(input, rules)` API.
import rules, { RuleContext, RuleSpec, getSize } from './rules';
import replacers from './replacers';
import defaultMessages, { SizeType } from './messages';
import { RuleParser, parseRule, initializeAndGatherData } from './ruleParser';
import { isNull, isString, isBool, isArray, isScalar, isPlainObject, keyExists, trim, snake, studly, ucfirst, toStr, values } from './php';
import { arrGet, arrHas, arrSet, arrForget, dataGet } from './data';
import type * as types from './types';

const HASH = 'k3Xq8vZp2Lm9';
const DOT = `__dot__${HASH}`;
const ASTERISK = `__asterisk__${HASH}`;
const MISSING = Symbol('missing');

const IMPLICIT_RULES = [
	'accepted', 'accepted_if', 'declined', 'declined_if', 'filled',
	'missing', 'missing_if', 'missing_unless', 'missing_with', 'missing_with_all',
	'present', 'present_if', 'present_unless', 'present_with', 'present_with_all',
	'required', 'required_if', 'required_if_accepted', 'required_if_declined', 'required_unless',
	'required_with', 'required_with_all', 'required_without', 'required_without_all',
];

const DEPENDENT_RULES = [
	'after', 'after_or_equal', 'before', 'before_or_equal', 'confirmed', 'different',
	'exclude_if', 'exclude_unless', 'exclude_with', 'exclude_without', 'gt', 'gte', 'lt', 'lte',
	'accepted_if', 'declined_if', 'required_if', 'required_if_accepted', 'required_if_declined', 'required_unless',
	'required_with', 'required_with_all', 'required_without', 'required_without_all',
	'present_if', 'present_unless', 'present_with', 'present_with_all',
	'prohibited', 'prohibited_if', 'prohibited_if_accepted', 'prohibited_if_declined', 'prohibited_unless', 'prohibits',
	'missing_if', 'missing_unless', 'missing_with', 'missing_with_all', 'same', 'unique',
];

const EXCLUDE_RULES = ['exclude', 'exclude_if', 'exclude_unless', 'exclude_with', 'exclude_without'];
const SIZE_RULES = ['size', 'between', 'min', 'max', 'gt', 'lt', 'gte', 'lte'];
const NUMERIC_RULES = ['numeric', 'integer', 'decimal'];
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wildcardPattern = (key: string): RegExp => new RegExp(`^${escapeRegex(key).replace(/\\\*/g, '([^.]*)')}$`, 'u');

function ordinal(n: number): string {
	const mod100 = n % 100;
	const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';

	return `${n}${suffix}`;
}

class ValidationError extends Error {
	constructor(readonly validator: Validator<any>) {
		super(validator.errors[0] ?? 'The given data was invalid.');
		this.name = 'ValidationError';
	}

	get errors(): Record<string, string[]> {
		return this.validator.messages;
	}
}

class Validator<TInput extends object = types.ValidationInput> implements RuleContext {
	valid: boolean | null = null;
	errors: string[] = [];
	fieldErrors: types.FieldError[] = [];
	messages: Record<string, string[]> = {};

	input: TInput;
	data: Record<string, unknown>;
	rules: Record<string, RuleSpec[]> = {};
	initialRules: Record<string, unknown> = {};
	customMessages: types.CustomMessages;
	customAttributes: types.CustomAttributes;
	customValues: Record<string, Record<string, string>> = {};
	implicitAttributes: Record<string, string[]> = {};
	implicitAttributesFormatter: ((attribute: string) => string) | null = null;
	failedRules: Record<string, Record<string, string[]>> = {};
	numericRules: string[] = [...NUMERIC_RULES];
	excludeUnvalidatedArrayKeys = true;

	private excludeAttributes: string[] = [];
	private afterCallbacks: ((validator: Validator<any>) => void)[] = [];
	private shouldStopOnFirstFailure = false;
	private hasRun = false;

	static readonly ValidationError = ValidationError;
	static extensions: Record<string, types.ExtensionFn> = {};
	static implicitRules: string[] = [];
	static dependentRules: string[] = [];
	static replacers: Record<string, types.ReplacerFn> = {};
	static fallbackMessages: Record<string, string> = {};

	constructor(input: TInput, rules: types.ValidationRules, messages: types.CustomMessages = {}, attributes: types.CustomAttributes = {}) {
		this.input = input;
		this.customMessages = messages;
		this.customAttributes = attributes;
		this.data = this.parseData(input as Record<string, unknown>);
		this.setRules(rules);
	}

	static extend(rule: string, extension: types.ExtensionFn, message?: string): void {
		Validator.extensions[snake(rule)] = extension;
		if (message !== undefined) Validator.fallbackMessages[snake(rule)] = message;
	}

	static extendImplicit(rule: string, extension: types.ExtensionFn, message?: string): void {
		Validator.extend(rule, extension, message);
		Validator.implicitRules.push(snake(rule));
	}

	static extendDependent(rule: string, extension: types.ExtensionFn, message?: string): void {
		Validator.extend(rule, extension, message);
		Validator.dependentRules.push(snake(rule));
	}

	static replacer(rule: string, replacer: types.ReplacerFn): void {
		Validator.replacers[snake(rule)] = replacer;
	}

	// Keys containing dots or asterisks get placeholders so they are not read as paths.
	private parseData(data: Record<string, unknown>): Record<string, unknown> {
		const parse = (value: unknown): unknown => {
			if (Array.isArray(value)) return value.map(parse);
			if (isPlainObject(value)) {
				const out: Record<string, unknown> = {};
				for (const key of Object.keys(value)) {
					if (value[key] === undefined) continue;
					out[key.split('.').join(DOT).split('*').join(ASTERISK)] = parse(value[key]);
				}

				return out;
			}
			if (value instanceof String || value instanceof Number || value instanceof Boolean) return value.valueOf();

			return value;
		};

		const out: Record<string, unknown> = {};
		for (const key of Object.keys(data ?? {})) {
			if (data[key] === undefined) continue;
			out[key.split('.').join(DOT).split('*').join(ASTERISK)] = parse(data[key]);
		}

		return out;
	}

	private replacePlaceholders<T>(data: T): T {
		if (Array.isArray(data)) return data.map(v => this.replacePlaceholders(v)) as unknown as T;
		if (!isPlainObject(data)) return data;

		const out: Record<string, unknown> = {};
		for (const key of Object.keys(data))
			out[this.replacePlaceholderInString(key)] = this.replacePlaceholders(data[key]);

		return out as T;
	}

	private replacePlaceholderInString(value: string): string {
		return value.split(DOT).join('.').split(ASTERISK).join('*');
	}

	after(callback: (validator: Validator<any>) => void): this {
		this.afterCallbacks.push(callback);

		return this;
	}

	validate(): boolean {
		return this.passes();
	}

	passes(): boolean {
		this.messages = {};
		this.failedRules = {};
		this.hasRun = true;

		for (const [attribute, attributeRules] of Object.entries(this.rules)) {
			if (this.shouldBeExcluded(attribute)) {
				this.removeAttribute(attribute);
				continue;
			}
			if (this.shouldStopOnFirstFailure && Object.keys(this.messages).length > 0)
				break;

			for (const rule of attributeRules) {
				this.validateAttribute(attribute, rule);
				if (this.shouldBeExcluded(attribute) || this.shouldStopValidating(attribute))
					break;
			}
		}

		for (const attribute of Object.keys(this.rules))
			if (this.shouldBeExcluded(attribute))
				this.removeAttribute(attribute);

		for (const callback of this.afterCallbacks)
			callback(this);

		this.errors = Object.values(this.messages).flat();
		this.fieldErrors = Object.entries(this.messages).flatMap(([field, errors]) => errors.map(error => ({ field, error })));
		this.valid = this.errors.length === 0;

		return this.valid;
	}

	fails(): boolean {
		return !this.passes();
	}

	private shouldBeExcluded(attribute: string): boolean {
		return this.excludeAttributes.some(excluded => attribute === excluded || attribute.startsWith(`${excluded}.`));
	}

	private removeAttribute(attribute: string): void {
		arrForget(this.data, attribute);
		delete this.rules[attribute];
	}

	validated(): Record<string, any> {
		if (!this.hasRun) this.passes();
		if (this.errors.length > 0) throw new ValidationError(this);

		const results: Record<string, unknown> = {};
		const ruleKeys = Object.keys(this.rules);
		for (const [key, attributeRules] of Object.entries(this.rules)) {
			const value = dataGet(this.data, key, MISSING);
			if (this.excludeUnvalidatedArrayKeys
				&& (attributeRules.includes('array') || attributeRules.includes('list'))
				&& value !== null
				&& ruleKeys.some(k => k.startsWith(`${key}.`)))
				continue;
			if (value !== MISSING) arrSet(results, key, value);
		}

		return this.replacePlaceholders(this.restoreLists(results, this.data)) as Record<string, any>;
	}

	// arrSet builds objects; turn them back into arrays where the input had arrays.
	private restoreLists(built: unknown, source: unknown): unknown {
		if (!isPlainObject(built)) return built;
		const keys = Object.keys(built);
		for (const key of keys)
			built[key] = this.restoreLists(built[key], isArray(source) ? arrGet(source, key) : null);
		if (Array.isArray(source) && keys.every((k, i) => k === String(i)))
			return keys.map(k => built[k]);

		return built;
	}

	private validateAttribute(attribute: string, rule: RuleSpec): void {
		if (typeof rule === 'function') {
			this.validateUsingClosure(attribute, rule as types.RuleClosure);

			return;
		}

		let [name, parameters] = parseRule(rule);
		if (name === '') return;

		if (this.dependsOnOtherFields(name)) {
			parameters = parameters.map(p => p.split('\\.').join(DOT));
			const keys = this.getExplicitKeys(attribute);
			if (keys.length > 0)
				parameters = parameters.map(p => p.split('*').map((part, i) => i === 0 ? part : `${keys[i - 1] ?? '*'}${part}`).join(''));
		}

		const value = this.getValue(attribute);
		const validatable = this.isValidatable(name, attribute, value);
		this.numericRules = [...NUMERIC_RULES];

		const fn = rules[name];
		const extension = Validator.extensions[name];
		if (!fn && !extension)
			throw new Error(`Method Validator::validate${studly(name)} does not exist.`);

		const passed = fn ? fn(this, attribute, value, parameters) : extension(attribute, value, parameters, this);
		if (validatable && !passed)
			this.addFailure(attribute, name, parameters);
	}

	private validateUsingClosure(attribute: string, rule: types.RuleClosure): void {
		const value = this.getValue(attribute);
		const implicit = (rule as any).implicit === true;
		if (!implicit && !this.isValidatable('closure', attribute, value))
			return;

		const original = this.replacePlaceholderInString(attribute);
		rule(original, isArray(value) ? this.replacePlaceholders(value) : value, (message: string) => {
			(this.failedRules[original] ??= {}).closure = [];
			(this.messages[original] ??= []).push(this.makeReplacements(message, original, 'closure', []));
		}, this);
	}

	private dependsOnOtherFields(rule: string): boolean {
		return DEPENDENT_RULES.includes(rule) || Validator.dependentRules.includes(rule);
	}

	private getExplicitKeys(attribute: string): string[] {
		const pattern = new RegExp(`^${escapeRegex(this.getPrimaryAttribute(attribute)).replace(/\\\*/g, '([^.]+)')}`);

		return pattern.exec(attribute)?.slice(1) ?? [];
	}

	getPrimaryAttribute(attribute: string): string {
		for (const [unparsed, parsed] of Object.entries(this.implicitAttributes))
			if (parsed.includes(attribute)) return unparsed;

		return attribute;
	}

	private isValidatable(rule: string, attribute: string, value: unknown): boolean {
		if (EXCLUDE_RULES.includes(rule)) return true;

		return this.presentOrRuleIsImplicit(rule, attribute, value)
			&& this.passesOptionalCheck(attribute)
			&& this.isNotNullIfMarkedAsNullable(rule, attribute);
	}

	private presentOrRuleIsImplicit(rule: string, attribute: string, value: unknown): boolean {
		if (isString(value) && trim(value) === '')
			return this.isImplicit(rule);

		return arrHas(this.data, attribute) || this.isImplicit(rule);
	}

	private isImplicit(rule: string): boolean {
		return IMPLICIT_RULES.includes(rule) || Validator.implicitRules.includes(rule);
	}

	private passesOptionalCheck(attribute: string): boolean {
		if (!this.hasRule(attribute, 'sometimes')) return true;

		const data = initializeAndGatherData(attribute, this.data);

		return attribute in data || keyExists(this.data, attribute);
	}

	private isNotNullIfMarkedAsNullable(rule: string, attribute: string): boolean {
		if (this.isImplicit(rule) || !this.hasRule(attribute, 'nullable')) return true;

		return !isNull(arrGet(this.data, attribute, 0));
	}

	private shouldStopValidating(attribute: string): boolean {
		const cleaned = this.replacePlaceholderInString(attribute);
		if (this.hasRule(attribute, 'bail'))
			return cleaned in this.messages;

		const implicit = [...IMPLICIT_RULES, ...Validator.implicitRules];

		return this.hasRule(attribute, implicit)
			&& cleaned in this.failedRules
			&& Object.keys(this.failedRules[cleaned]).some(r => implicit.includes(r));
	}

	addFailure(attribute: string, rule: string, parameters: string[] = []): void {
		const attributeWithPlaceholders = attribute;
		attribute = this.replacePlaceholderInString(attribute);

		if (EXCLUDE_RULES.includes(rule)) {
			if (!this.excludeAttributes.includes(attribute)) this.excludeAttributes.push(attribute);

			return;
		}
		if (this.dependsOnOtherFields(rule))
			parameters = parameters.map(p => p.split(DOT).join('.'));

		const message = this.makeReplacements(this.getMessage(attributeWithPlaceholders, rule), attribute, rule, parameters);
		(this.messages[attribute] ??= []).push(message);
		(this.failedRules[attribute] ??= {})[rule] = parameters;
	}

	failed(): Record<string, Record<string, string[]>> {
		return this.failedRules;
	}

	hasRule(attribute: string, names: string | string[]): boolean {
		return this.getRule(attribute, names) !== null;
	}

	getRule(attribute: string, names: string | string[]): [string, string[]] | null {
		if (!(attribute in this.rules)) return null;

		const list = Array.isArray(names) ? names : [names];
		for (const rule of this.rules[attribute]) {
			if (typeof rule === 'function') continue;
			const parsed = parseRule(rule);
			if (list.includes(parsed[0])) return parsed;
		}

		return null;
	}

	getData(): Record<string, unknown> {
		return this.data;
	}

	getValue(attribute: string): unknown {
		return arrGet(this.data, attribute);
	}

	setValue(attribute: string, value: unknown): void {
		arrSet(this.data, attribute, value);
	}

	getRules(): Record<string, RuleSpec[]> {
		return this.rules;
	}

	setRules(rules: types.ValidationRules): this {
		const encoded: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(this.flattenNestedRules(rules)))
			encoded[key.split('\\.').join(DOT)] = value;

		this.initialRules = encoded;
		this.rules = {};
		this.addRules(encoded);

		return this;
	}

	// Rules nested as objects are sugar for dotted keys.
	private flattenNestedRules(rules: types.ValidationRules, prefix = ''): Record<string, unknown> {
		const out: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(rules)) {
			if (isPlainObject(value)) Object.assign(out, this.flattenNestedRules(value as types.ValidationRules, `${prefix}${key}.`));
			else out[`${prefix}${key}`] = value;
		}

		return out;
	}

	addRules(rules: Record<string, unknown>): void {
		const response = new RuleParser(this.data).explode(rules);
		for (const [key, rule] of Object.entries(response.rules))
			this.rules[key] = [...(this.rules[key] ?? []), ...rule];

		this.implicitAttributes = { ...this.implicitAttributes, ...response.implicitAttributes };
	}

	sometimes(attribute: string | string[], rules: types.FieldRules, callback: (input: Record<string, any>, item: any) => boolean): this {
		const payload = this.replacePlaceholders(this.data);
		for (const key of Array.isArray(attribute) ? attribute : [attribute]) {
			const response = new RuleParser(this.data).explode({ [key]: rules });
			this.implicitAttributes = { ...response.implicitAttributes, ...this.implicitAttributes };
			for (const [ruleKey, ruleValue] of Object.entries(response.rules))
				if (callback(payload, this.dataForSometimesIteration(ruleKey, !key.endsWith('.*'))))
					this.addRules({ [ruleKey.split('\\.').join(DOT)]: ruleValue });
		}

		return this;
	}

	private dataForSometimesIteration(attribute: string, removeLastSegment: boolean): unknown {
		const lastDot = attribute.lastIndexOf('.');
		const path = lastDot !== -1 && removeLastSegment ? attribute.slice(0, lastDot) : attribute;

		return this.replacePlaceholders(dataGet(this.data, path));
	}

	stopOnFirstFailure(flag = true): this {
		this.shouldStopOnFirstFailure = flag;

		return this;
	}

	setCustomMessages(messages: types.CustomMessages): this {
		this.customMessages = { ...this.customMessages, ...messages };

		return this;
	}

	setAttributeNames(attributes: types.CustomAttributes): this {
		this.customAttributes = attributes;

		return this;
	}

	addCustomAttributes(attributes: types.CustomAttributes): this {
		this.customAttributes = { ...this.customAttributes, ...attributes };

		return this;
	}

	setValueNames(values: Record<string, Record<string, string>>): this {
		this.customValues = values;

		return this;
	}

	addCustomValues(values: Record<string, Record<string, string>>): this {
		this.customValues = { ...this.customValues, ...values };

		return this;
	}

	setImplicitAttributesFormatter(formatter: ((attribute: string) => string) | null): this {
		this.implicitAttributesFormatter = formatter;

		return this;
	}

	getSize(attribute: string, value: unknown): string | number {
		return getSize(this, attribute, value);
	}

	private getMessage(attribute: string, rule: string): string {
		const attributeWithPlaceholders = attribute;
		attribute = this.replacePlaceholderInString(attribute);

		const inline = this.getInlineMessage(attribute, rule);
		if (inline !== null) return inline;
		if (SIZE_RULES.includes(rule)) return this.getSizeMessage(attributeWithPlaceholders, rule);

		const line = defaultMessages[rule];
		if (isString(line)) return line;

		const fallback = this.getFromLocalArray(attribute, rule, Validator.fallbackMessages);

		return isString(fallback) ? fallback : `validation.${rule}`;
	}

	private getInlineMessage(attribute: string, rule: string): string | null {
		const entry = this.getFromLocalArray(attribute, rule);
		if (isString(entry)) return entry;
		if (!isPlainObject(entry) || !SIZE_RULES.includes(rule)) return null;

		const typed = entry[this.getAttributeType(attribute)];

		return isString(typed) ? typed : null;
	}

	private getFromLocalArray(attribute: string, rule: string, source: Record<string, unknown> = this.customMessages): unknown {
		for (const key of [`${attribute}.${rule}`, rule, attribute]) {
			for (const sourceKey of Object.keys(source)) {
				const message = source[sourceKey];
				if (sourceKey.includes('*')) {
					if (!wildcardPattern(sourceKey).test(key)) continue;

					return isPlainObject(message) ? message[rule] ?? null : message;
				}
				if (sourceKey !== key) continue;

				return sourceKey === attribute && isPlainObject(message) ? message[rule] ?? null : message;
			}
		}

		return null;
	}

	private getSizeMessage(attribute: string, rule: string): string {
		const line = defaultMessages[rule];

		return isString(line) ? line : line[this.getAttributeType(attribute)];
	}

	private getAttributeType(attribute: string): SizeType {
		if (this.hasRule(attribute, this.numericRules)) return 'numeric';
		if (this.hasRule(attribute, ['array', 'list'])) return 'array';

		return 'string';
	}

	makeReplacements(message: string, attribute: string, rule: string, parameters: string[]): string {
		const displayable = this.getDisplayableAttribute(attribute);
		message = message.split(':attribute').join(displayable).split(':ATTRIBUTE').join(displayable.toUpperCase()).split(':Attribute').join(ucfirst(displayable));
		message = this.replaceInputPlaceholder(message, attribute);
		message = this.replaceIndexOrPositionPlaceholder(message, attribute, 'index', n => String(n));
		message = this.replaceIndexOrPositionPlaceholder(message, attribute, 'position', n => String(n + 1));
		message = this.replaceIndexOrPositionPlaceholder(message, attribute, 'ordinal-position', n => ordinal(n + 1));

		if (Validator.replacers[rule]) return Validator.replacers[rule](message, attribute, rule, parameters, this);
		if (replacers[rule]) return replacers[rule](this, message, attribute, rule, parameters);

		return message;
	}

	getDisplayableAttribute(attribute: string): string {
		const primary = this.getPrimaryAttribute(attribute);
		for (const name of attribute !== primary ? [attribute, primary] : [attribute]) {
			const inline = this.getAttributeFromLocalArray(name);
			if (inline !== null) return inline;
		}
		if (primary in this.implicitAttributes)
			return this.implicitAttributesFormatter ? this.implicitAttributesFormatter(attribute) : attribute;

		return snake(attribute).split('_').join(' ');
	}

	private getAttributeFromLocalArray(attribute: string): string | null {
		if (this.customAttributes[attribute] !== undefined) return this.customAttributes[attribute];
		for (const sourceKey of Object.keys(this.customAttributes))
			if (sourceKey.includes('*') && wildcardPattern(sourceKey).test(attribute)) return this.customAttributes[sourceKey];

		return null;
	}

	private replaceInputPlaceholder(message: string, attribute: string): string {
		if (!message.includes(':input')) return message;

		const actual = this.getValue(attribute);
		if (isScalar(actual) || isNull(actual))
			message = message.split(':input').join(this.getDisplayableValue(attribute, actual));

		return message;
	}

	private replaceIndexOrPositionPlaceholder(message: string, attribute: string, placeholder: string, modifier: (n: number) => string): string {
		const lower = message.toLowerCase();
		if (!lower.includes(`:${placeholder}`) && !lower.includes(`-${placeholder}`)) return message;

		let numericIndex = 1;
		for (const segment of attribute.split('.')) {
			if (!/^\d+$/.test(segment)) continue;
			const replacement = modifier(Number(segment));
			if (numericIndex === 1) message = message.replace(new RegExp(`:${placeholder}`, 'gi'), replacement);
			message = message.replace(new RegExp(`:${ORDINALS[numericIndex - 1] ?? 'other'}-${placeholder}`, 'gi'), replacement);
			numericIndex++;
		}

		return message;
	}

	getDisplayableValue(attribute: string, value: unknown): string {
		const custom = this.customValues[attribute]?.[toStr(value)];
		if (custom !== undefined) return custom;
		if (isArray(value)) return 'array';
		if (isBool(value)) return value ? 'true' : 'false';
		if (isNull(value)) return 'empty';

		return toStr(value);
	}
}

export = Validator;

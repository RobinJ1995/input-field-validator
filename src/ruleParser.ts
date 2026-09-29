// Port of Illuminate\Validation\ValidationRuleParser: explodes pipe strings and
// expands wildcard attributes against the data.
import { isPlainObject, isString, trim, studly, snake, strGetCsv } from './php';
import { arrDot, arrGet, dataSet, deepClone, leadingExplicitPath, extractDataFromPath } from './data';
import { RuleSpec } from './rules';

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface ExplodedRules {
	rules: Record<string, RuleSpec[]>;
	implicitAttributes: Record<string, string[]>;
}

export function parseRule(rule: RuleSpec): [string, string[]] {
	if (typeof rule === 'function')
		return ['closure', []];

	let name: string, parameters: string[];
	if (Array.isArray(rule)) {
		name = trim(String(rule[0] ?? ''));
		parameters = rule.slice(1).map(String);
	} else {
		[name, parameters] = parseStringRule(rule as string);
	}

	return [normalizeRule(name), parameters];
}

function parseStringRule(rule: string): [string, string[]] {
	const colon = rule.indexOf(':');
	if (colon === -1)
		return [trim(rule), []];

	const name = rule.slice(0, colon);
	const parameter = rule.slice(colon + 1);
	const isRegex = ['regex', 'not_regex', 'notregex'].includes(name.toLowerCase());

	return [trim(name), isRegex ? [parameter] : strGetCsv(parameter)];
}

function normalizeRule(name: string): string {
	const studlyName = studly(name);
	if (studlyName === 'Int') return 'integer';
	if (studlyName === 'Bool') return 'boolean';

	return snake(studlyName);
}

// Initializes wildcard paths on a copy of the data and gathers every matching key.
export function initializeAndGatherData(attribute: string, masterData: Record<string, unknown>): Record<string, unknown> {
	let data = deepClone(extractDataFromPath(leadingExplicitPath(attribute), masterData));
	if (attribute.includes('*') && !attribute.endsWith('*'))
		data = dataSet(data, attribute, null, true);

	const dotted = arrDot(data);
	const pattern = new RegExp(`^${escapeRegex(attribute).replace(/\\\*/g, '[^.]+')}`);
	const wildcards: Record<string, unknown> = {};
	for (const key of Object.keys(dotted)) {
		const m = pattern.exec(key);
		if (m) wildcards[m[0]] = arrGet(masterData, m[0]);
	}

	return { ...dotted, ...wildcards };
}

export class RuleParser {
	implicitAttributes: Record<string, string[]> = {};

	constructor(private data: Record<string, unknown>) {}

	explode(rules: Record<string, unknown>): ExplodedRules {
		this.implicitAttributes = {};

		return { rules: this.explodeRules({ ...rules }), implicitAttributes: this.implicitAttributes };
	}

	private explodeRules(rules: Record<string, unknown>): Record<string, RuleSpec[]> {
		const results: Record<string, unknown> = rules;
		for (const [key, rule] of Object.entries(rules)) {
			if (key.includes('*')) {
				this.explodeWildcardRules(results, key, [rule]);
				delete results[key];
			} else {
				results[key] = this.explodeExplicitRule(rule);
			}
		}

		return results as Record<string, RuleSpec[]>;
	}

	private explodeExplicitRule(rule: unknown): RuleSpec[] {
		if (isString(rule)) return rule.split('|');
		if (Array.isArray(rule)) return rule.map(r => isPlainObject(r) ? String(r) : r) as RuleSpec[];

		return [rule as RuleSpec];
	}

	private explodeWildcardRules(results: Record<string, unknown>, attribute: string, rules: unknown[]): void {
		const pattern = new RegExp(`^${escapeRegex(attribute).replace(/\\\*/g, '[^.]*')}$`);
		const data = initializeAndGatherData(attribute, this.data);

		for (const key of Object.keys(data)) {
			if (!key.startsWith(attribute) && !pattern.test(key)) continue;
			for (const rule of rules) {
				(this.implicitAttributes[attribute] ??= []).push(key);
				this.mergeRulesForAttributeInto(results, key, rule);
			}
		}
	}

	private mergeRulesForAttributeInto(results: Record<string, unknown>, attribute: string, rules: unknown): void {
		const existing = attribute in results ? this.explodeExplicitRule(results[attribute]) : [];
		results[attribute] = [...existing, ...this.explodeExplicitRule(rules)];
	}
}

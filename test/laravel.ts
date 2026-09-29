// Cases ported from laravel/framework tests/Validation/ValidationValidatorTest.php
// (MIT, Copyright (c) Taylor Otwell; see test/LICENSE-laravel.md).
process.env.TZ = 'UTC';

import assert from 'assert';
import Validator = require('../src/Validator');
import { parseDate } from '../src/dates';
import cases from './laravel-cases.json';

interface Case {
	test: string;
	line: number;
	data: Record<string, any>;
	rules: Record<string, any>;
	messages?: Record<string, any>;
	attributes?: Record<string, string>;
	assertions: { type: string; expected: any }[];
}

// PHP DateTime objects were exported as {"__date__": "..."} markers.
function revive(value: any): any {
	if (Array.isArray(value)) return value.map(revive);
	if (value && typeof value === 'object') {
		if ('__date__' in value) return value.__date__ === null ? new Date() : new Date(parseDate(value.__date__)!.time);
		const out: Record<string, any> = {};
		for (const key of Object.keys(value)) out[key] = revive(value[key]);

		return out;
	}

	return value;
}

const grouped = new Map<string, Case[]>();
for (const c of cases as Case[])
	grouped.set(c.test, [...(grouped.get(c.test) ?? []), c]);

describe('Laravel ValidationValidatorTest', () => {
	for (const [test, testCases] of grouped) {
		describe(test, () => {
			for (const c of testCases) {
				it(`line ${c.line}: ${JSON.stringify(c.rules)} on ${JSON.stringify(c.data)}`, () => {
					const validator = new Validator(revive(c.data), c.rules, c.messages ?? {}, c.attributes ?? {});
					validator.excludeUnvalidatedArrayKeys = false;
					for (const assertion of c.assertions) {
						switch (assertion.type) {
							case 'passes':
								assert.strictEqual(validator.passes(), assertion.expected, JSON.stringify(validator.messages));
								break;
							case 'validated':
								assert.deepStrictEqual(validator.validated(), Array.isArray(assertion.expected) ? {} : revive(assertion.expected));
								break;
							case 'keys':
								validator.passes();
								assert.deepStrictEqual(Object.keys(validator.messages), assertion.expected);
								break;
							case 'count':
								validator.passes();
								assert.strictEqual(Object.values(validator.messages).flat().length, assertion.expected);
								break;
						}
					}
				});
			}
		});
	}
});

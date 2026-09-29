// Laravel's Arr / data_get / data_set helpers over JS arrays and plain objects.
import { isArray, isPlainObject, keyExists, arrayGet, count, keys, PhpArray } from './php';

const MISSING = Symbol('missing');

export function arrGet(data: unknown, key: string, fallback: unknown = null): unknown {
	if (!isArray(data)) return fallback;
	if (keyExists(data, key)) return arrayGet(data, key);

	let current: unknown = data;
	for (const segment of key.split('.')) {
		if (!isArray(current) || !keyExists(current, segment)) return fallback;
		current = arrayGet(current, segment);
	}

	return current;
}

export function arrHas(data: unknown, key: string | string[]): boolean {
	const list = Array.isArray(key) ? key : [key];
	if (!isArray(data) || list.length === 0) return false;

	return list.every(k => arrGet(data, k, MISSING) !== MISSING);
}

export const arrHasAny = (data: unknown, keys: string[]): boolean => keys.some(k => arrHas(data, k));

export function arrSet(data: Record<string, unknown>, key: string, value: unknown): void {
	const segments = key.split('.');
	let current: any = data;
	for (const segment of segments.slice(0, -1)) {
		if (!isArray(current[segment])) current[segment] = {};
		current = current[segment];
	}
	current[segments[segments.length - 1]] = value;
}

export function arrForget(data: unknown, key: string): void {
	if (!isArray(data)) return;
	if (keyExists(data, key)) {
		remove(data, key);

		return;
	}

	const segments = key.split('.');
	let current: unknown = data;
	for (const segment of segments.slice(0, -1)) {
		if (!isArray(current) || !keyExists(current, segment)) return;
		current = arrayGet(current, segment);
	}
	if (isArray(current)) remove(current, segments[segments.length - 1]);
}

function remove(target: PhpArray, key: string): void {
	if (Array.isArray(target)) target.splice(Number(key), 1);
	else delete target[key];
}

// Flattens to dotted keys; empty arrays stay as leaves, like Arr::dot.
export function arrDot(data: PhpArray, prefix = ''): Record<string, unknown> {
	const results: Record<string, unknown> = {};
	for (const key of keys(data)) {
		const value = arrayGet(data, key);
		if (isArray(value) && count(value) > 0)
			Object.assign(results, arrDot(value, `${prefix}${key}.`));
		else
			results[`${prefix}${key}`] = value;
	}

	return results;
}

export function dataGet(target: unknown, key: string | string[] | null, fallback: unknown = null): unknown {
	if (key === null) return target;

	const segments = Array.isArray(key) ? [...key] : key.split('.');
	while (segments.length > 0) {
		const segment = segments.shift() as string;
		if (segment === '*') {
			if (!isArray(target)) return fallback;
			const result = keys(target).map(k => dataGet(arrayGet(target as PhpArray, k), [...segments]));

			return segments.includes('*') ? result.flat() : result;
		}
		if (isArray(target) && keyExists(target, segment)) target = arrayGet(target, segment);
		else return fallback;
	}

	return target;
}

export function dataSet(target: any, key: string | string[], value: unknown, overwrite = true): any {
	const segments = Array.isArray(key) ? [...key] : key.split('.');
	const segment = segments.shift() as string;

	if (segment === '*') {
		if (!isArray(target)) target = {};
		const container: any = target;
		for (const k of keys(target)) {
			if (segments.length > 0) container[k] = dataSet(container[k], [...segments], value, overwrite);
			else if (overwrite) container[k] = value;
		}
	} else if (isArray(target)) {
		if (Array.isArray(target) && !/^\d+$/.test(segment))
			target = Object.fromEntries(target.map((v, i) => [String(i), v]));
		const container: any = target;
		if (segments.length > 0) {
			if (!keyExists(target, segment)) container[segment] = {};
			container[segment] = dataSet(container[segment], segments, value, overwrite);
		} else if (overwrite || !keyExists(target, segment)) {
			container[segment] = value;
		}
	} else {
		target = {};
		if (segments.length > 0) target[segment] = dataSet(undefined, segments, value, overwrite);
		else if (overwrite) target[segment] = value;
	}

	return target;
}

export function deepClone<T>(value: T): T {
	if (Array.isArray(value)) return value.map(deepClone) as unknown as T;
	if (isPlainObject(value)) {
		const out: Record<string, unknown> = {};
		for (const k of Object.keys(value)) out[k] = deepClone(value[k]);

		return out as T;
	}

	return value;
}

// ValidationData::getLeadingExplicitAttributePath
export function leadingExplicitPath(attribute: string): string | null {
	return attribute.split('*')[0].replace(/\.+$/, '') || null;
}

// ValidationData::extractDataFromPath
export function extractDataFromPath(path: string | null, data: Record<string, unknown>): Record<string, unknown> {
	if (path === null) return data;

	const results: Record<string, unknown> = {};
	const value = arrGet(data, path, MISSING);
	if (value !== MISSING) arrSet(results, path, value);

	return results;
}

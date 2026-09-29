// PHP semantics that the Laravel rules depend on, reproduced in JS.

export type PhpArray = unknown[] | Record<string, unknown>;

export const isNull = (v: unknown): v is null | undefined => v === null || v === undefined;
export const isString = (v: unknown): v is string => typeof v === 'string';
export const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
export const isNumber = (v: unknown): v is number => typeof v === 'number';
export const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
export const isScalar = (v: unknown): v is string | number | boolean =>
	typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';

export function isPlainObject(v: unknown): v is Record<string, unknown> {
	if (v === null || typeof v !== 'object' || Array.isArray(v))
		return false;

	const proto = Object.getPrototypeOf(v);

	return proto === Object.prototype || proto === null;
}

// A PHP array is either a list or a map, so both JS arrays and plain objects count.
export const isArray = (v: unknown): v is PhpArray => Array.isArray(v) || isPlainObject(v);

export const isStringable = (v: unknown): boolean =>
	typeof v === 'object' && v !== null && !isArray(v) && typeof (v as any).toString === 'function'
	&& (v as any).toString !== Object.prototype.toString;

export const count = (v: PhpArray): number => Array.isArray(v) ? v.length : Object.keys(v).length;
export const values = (v: PhpArray): unknown[] => Array.isArray(v) ? v : Object.values(v);
export const keys = (v: PhpArray): string[] => Array.isArray(v) ? v.map((_, i) => String(i)) : Object.keys(v);

export const isList = (v: unknown): boolean =>
	Array.isArray(v) || (isPlainObject(v) && Object.keys(v).every((k, i) => k === String(i)));

export function keyExists(arr: unknown, key: string | number): boolean {
	if (Array.isArray(arr))
		return /^\d+$/.test(String(key)) && Number(key) < arr.length && String(key) in arr;
	if (isPlainObject(arr))
		return Object.prototype.hasOwnProperty.call(arr, String(key));

	return false;
}

export const arrayGet = (arr: PhpArray, key: string | number): unknown => (arr as any)[key];

export function gettype(v: unknown): string {
	if (isNull(v)) return 'NULL';
	if (isBool(v)) return 'boolean';
	if (isNumber(v)) return Number.isInteger(v) ? 'integer' : 'double';
	if (isString(v)) return 'string';
	if (isArray(v)) return 'array';

	return 'object';
}

const NUMERIC = /^[ \t\n\r\v\f]*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?[ \t\n\r\v\f]*$/;

export const isNumeric = (v: unknown): boolean => isNumber(v) || (isString(v) && NUMERIC.test(v));

export const toNumber = (v: unknown): number => isNumber(v) ? v : Number(trim(String(v), ' \t\n\r\v\f'));

export function toBool(v: unknown): boolean {
	if (isNull(v)) return false;
	if (isBool(v)) return v;
	if (isNumber(v)) return v !== 0;
	if (isString(v)) return v !== '' && v !== '0';
	if (isArray(v)) return count(v) > 0;

	return true;
}

function floatToString(n: number): string {
	if (!Number.isFinite(n))
		return Number.isNaN(n) ? 'NAN' : (n > 0 ? 'INF' : '-INF');
	if (Number.isInteger(n) && Math.abs(n) < 1e15)
		return String(n);

	const exponent = Math.floor(Math.log10(Math.abs(n)));
	if (exponent < -5 || exponent >= 15) {
		let [mantissa, exp] = n.toExponential(13).split('e');
		mantissa = mantissa.replace(/\.?0+$/, '');
		if (!mantissa.includes('.')) mantissa += '.0';

		return `${mantissa}E${exp[0] === '-' ? '-' : '+'}${exp.replace(/^[+-]/, '')}`;
	}

	return String(parseFloat(n.toPrecision(14)));
}

// PHP's (string) cast.
export function toStr(v: unknown): string {
	if (isNull(v)) return '';
	if (isBool(v)) return v ? '1' : '';
	if (isNumber(v)) return floatToString(v);
	if (isString(v)) return v;
	if (isArray(v)) return 'Array';

	return String(v);
}

// PHP 8 `==`.
export function looseEquals(a: unknown, b: unknown): boolean {
	if (a === undefined) a = null;
	if (b === undefined) b = null;

	if (isArray(a) || isArray(b)) {
		if (isArray(a) && isArray(b))
			return count(a) === count(b) && keys(a).every(k => keyExists(b, k) && looseEquals(arrayGet(a, k), arrayGet(b, k)));
		const [arr, other] = isArray(a) ? [a, b] : [b as PhpArray, a];
		if (other === null) return count(arr) === 0;
		if (isBool(other)) return toBool(arr) === other;

		return false;
	}
	if (a instanceof Date || b instanceof Date)
		return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
	if (a === null && b === null) return true;
	if (isBool(a) || isBool(b)) return toBool(a) === toBool(b);
	if (a === null) return isString(b) ? b === '' : !toBool(b);
	if (b === null) return isString(a) ? a === '' : !toBool(a);
	if (isNumber(a) && isNumber(b)) return a === b;
	if (isNumber(a) && isString(b)) return isNumeric(b) ? a === toNumber(b) : toStr(a) === b;
	if (isString(a) && isNumber(b)) return isNumeric(a) ? toNumber(a) === b : a === toStr(b);
	if (isString(a) && isString(b))
		return isNumeric(a) && isNumeric(b) ? toNumber(a) === toNumber(b) : a === b;

	return a === b;
}

// PHP `===`, which compares arrays by content.
export function strictEquals(a: unknown, b: unknown): boolean {
	if (a === undefined) a = null;
	if (b === undefined) b = null;

	if (isArray(a) && isArray(b)) {
		const ka = keys(a), kb = keys(b);

		return ka.length === kb.length && ka.every((k, i) => k === kb[i] && strictEquals(arrayGet(a, k), arrayGet(b, k)));
	}

	return a === b;
}

export const inArray = (needle: unknown, haystack: unknown[], strict = false): boolean =>
	haystack.some(item => strict ? strictEquals(needle, item) : looseEquals(needle, item));

export function trim(s: string, chars = ' \t\n\r\0\x0B'): string {
	let start = 0, end = s.length;
	while (start < end && chars.includes(s[start])) start++;
	while (end > start && chars.includes(s[end - 1])) end--;

	return s.slice(start, end);
}

export const mbStrlen = (s: string): number => Array.from(s).length;

export function strlen(s: string): number {
	let n = 0;
	for (const ch of s) {
		const c = ch.codePointAt(0) as number;
		n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
	}

	return n;
}

export const ucfirst = (s: string): string => s === '' ? s : Array.from(s)[0].toUpperCase() + s.slice(Array.from(s)[0].length);

export const ucwords = (s: string): string => s.replace(/(^|[ \t\r\n\f\v])(\S)/g, (_, sep, ch) => sep + ch.toUpperCase());

export function snake(value: string, delimiter = '_'): string {
	if (/^[a-z]+$/.test(value))
		return value;

	return ucwords(value).replace(/\s+/gu, '').replace(/(.)(?=[A-Z])/gu, `$1${delimiter}`).toLowerCase();
}

export const studly = (value: string): string => value.replace(/[-_]/g, ' ').split(/\s+/u).map(ucfirst).join('');

const INT64_MAX = 9223372036854775807n;

export function filterVarInt(v: unknown): number | false {
	if (isBool(v)) return v ? 1 : false;
	if (isNumber(v)) return Number.isInteger(v) && Math.abs(v) < 9.2e18 ? v : false;
	if (!isString(v)) return false;

	const s = trim(v, ' \t\r\v\n');
	if (!/^[+-]?(0|[1-9]\d*)$/.test(s)) return false;
	const big = BigInt(s);
	if (big > INT64_MAX || big < -INT64_MAX - 1n) return false;

	return Number(s);
}

// PHP's str_getcsv with the default delimiter, enclosure and escape character.
export function strGetCsv(input: string): string[] {
	const fields: string[] = [];
	let i = 0;

	while (true) {
		let field = '';
		if (input[i] === '"') {
			i++;
			while (i < input.length) {
				if (input[i] === '\\' && input[i + 1] === '"') {
					field += '\\"';
					i += 2;
				} else if (input[i] === '"') {
					if (input[i + 1] === '"') {
						field += '"';
						i += 2;
					} else {
						i++;
						break;
					}
				} else {
					field += input[i++];
				}
			}
		}
		while (i < input.length && input[i] !== ',')
			field += input[i++];
		fields.push(field);

		if (input[i] !== ',')
			return fields;
		i++;
	}
}

const POSIX_CLASSES: Record<string, string> = {
	alpha: 'A-Za-z', digit: '0-9', alnum: 'A-Za-z0-9', upper: 'A-Z', lower: 'a-z',
	space: ' \\t\\n\\r\\f\\v', xdigit: '0-9A-Fa-f', punct: '!-\\/:-@\\[-`{-~', word: 'A-Za-z0-9_',
};

// Translates a PCRE pattern with delimiters and modifiers into a JS RegExp.
export function pcreToRegExp(pattern: string): RegExp {
	const delimiter = pattern[0];
	if (!delimiter || /[\s\\a-zA-Z0-9]/.test(delimiter))
		throw new Error(`preg_match(): Delimiter must not be alphanumeric, backslash, or NUL in "${pattern}"`);

	const closing = ({ '(': ')', '[': ']', '{': '}', '<': '>' } as Record<string, string>)[delimiter] ?? delimiter;
	const end = pattern.lastIndexOf(closing);
	if (end <= 0)
		throw new Error(`preg_match(): No ending delimiter '${closing}' found in "${pattern}"`);

	const modifiers = pattern.slice(end + 1);
	const extended = modifiers.includes('x');
	const dollarEndOnly = modifiers.includes('D') || modifiers.includes('m');
	let flags = ['i', 'm', 's', 'u'].filter(f => modifiers.includes(f)).join('');

	let source = '';
	let inClass = false;
	const body = pattern.slice(1, end);
	for (let i = 0; i < body.length; i++) {
		const ch = body[i];
		if (ch === '\\') {
			const next = body[i + 1] ?? '';
			i++;
			if (next === closing || next === delimiter) source += (/[\^$\\.*+?()[\]{}|\/]/.test(next) ? '\\' : '') + next;
			else if (next === 'A') source += '^';
			else if (next === 'z') source += '$';
			else if (next === 'Z') source += '(?=\\n?$)';
			else if (next === 'h') source += '[ \\t]';
			else if (next === 'R') source += '(?:\\r\\n|\\n|\\r)';
			else if ((next === 'p' || next === 'P') && /[A-Za-z]/.test(body[i + 1] ?? '')) source += `\\${next}{${body[++i]}}`;
			else source += '\\' + next;
			continue;
		}
		if (inClass) {
			if (ch === '[' && body[i + 1] === ':') {
				const m = /^\[:(\^?)(\w+):\]/.exec(body.slice(i));
				if (m && POSIX_CLASSES[m[2]]) {
					source += m[1] ? `[^${POSIX_CLASSES[m[2]]}]` : POSIX_CLASSES[m[2]];
					i += m[0].length - 1;
					continue;
				}
			}
			if (ch === ']') inClass = false;
			source += ch;
			continue;
		}
		if (extended && /\s/.test(ch)) continue;
		if (extended && ch === '#') {
			while (i < body.length && body[i] !== '\n') i++;
			continue;
		}
		if (ch === '[') {
			inClass = true;
			source += ch;
			if (body[i + 1] === '^') source += body[++i];
			if (body[i + 1] === ']') source += '\\' + body[++i];
			continue;
		}
		source += ch === '$' && !dollarEndOnly ? '(?=\\n?$)' : ch;
	}

	if (/\\[pP]\{/.test(source) && !flags.includes('u'))
		flags += 'u';

	try {
		return new RegExp(source, flags);
	} catch (e) {
		if (!flags.includes('u')) throw e;

		return new RegExp(source, flags.replace('u', ''));
	}
}

export const isAscii = (s: string): boolean => !/[^\x09\x10\x13\x0A\x0D\x20-\x7E]/.test(s);

export interface Decimal {
	unscaled: bigint;
	scale: number;
}

// Exact decimal parsing, standing in for brick/math's BigNumber.
export function parseDecimal(value: unknown): Decimal | null {
	const s = isNumber(value) ? String(value) : isString(value) ? value : null;
	if (s === null) return null;

	const m = /^([+-])?(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(s);
	if (!m) return null;

	const integral = m[2] ?? '';
	const fraction = m[3] ?? m[4] ?? '';
	const exponent = Number(m[5] ?? 0);
	let unscaled = BigInt(integral + fraction || '0');
	let scale = fraction.length - exponent;
	if (scale < 0) {
		unscaled *= 10n ** BigInt(-scale);
		scale = 0;
	}
	if (m[1] === '-') unscaled = -unscaled;

	return { unscaled, scale };
}

function align(a: Decimal, b: Decimal): [bigint, bigint] {
	const scale = Math.max(a.scale, b.scale);

	return [a.unscaled * 10n ** BigInt(scale - a.scale), b.unscaled * 10n ** BigInt(scale - b.scale)];
}

export function compareDecimal(a: Decimal, b: Decimal): -1 | 0 | 1 {
	const [x, y] = align(a, b);

	return x < y ? -1 : x > y ? 1 : 0;
}

export function decimalRemainderIsZero(a: Decimal, b: Decimal): boolean {
	const [x, y] = align(a, b);

	return x % y === 0n;
}

export const isZero = (d: Decimal): boolean => d.unscaled === 0n;

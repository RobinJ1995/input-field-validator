// A subset of PHP's date parser: the formats strtotime, date_parse and
// DateTime::createFromFormat accept, as far as validation rules need them.

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DAY_RE = '(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?)';
const UNIT_RE = '(sec(?:ond)?|min(?:ute)?|hour|day|week|fortnight|forthnight|month|year|weekday|msec|millisecond|usec|microsecond)s?';
const NUMBER_WORDS: Record<string, number> = {
	a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
	first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12,
	next: 1, last: -1, previous: -1, this: 0,
};
const TZ_ABBREVIATIONS: Record<string, number> = {
	utc: 0, gmt: 0, z: 0, wet: 0, bst: 60, cet: 60, cest: 120, eet: 120, eest: 180, msk: 180,
	est: -300, edt: -240, cst: -360, cdt: -300, mst: -420, mdt: -360, pst: -480, pdt: -420, jst: 540, ist: 330,
};

const monthIndex = (name: string): number => MONTHS.findIndex(m => m.startsWith(name.slice(0, 3).toLowerCase()));
const dayIndex = (name: string): number => DAYS.findIndex(d => d.startsWith(name.slice(0, 3).toLowerCase()));

export interface ParsedDate {
	y?: number;
	m?: number;
	d?: number;
	time: number;
}

interface State {
	y?: number; m?: number; d?: number;
	h?: number; i?: number; s?: number; ms?: number;
	tz?: number;
	epoch?: number;
	rel: { y: number; m: number; d: number; h: number; i: number; s: number; ms: number };
	weekday?: { index: number; behavior: number };
	firstLastDayOf?: 'first' | 'last';
}

// Offset in minutes of an IANA zone at a given instant, via Intl.
export function zoneOffset(zone: string, utcMs: number): number | null {
	try {
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone: zone, hourCycle: 'h23',
			year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
		}).formatToParts(new Date(utcMs));
		const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
		const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));

		return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
	} catch {
		return null;
	}
}

function parseZone(text: string, referenceMs: number): number | null {
	const lower = text.toLowerCase();
	if (lower in TZ_ABBREVIATIONS) return TZ_ABBREVIATIONS[lower];

	const m = /^([+-])(\d{1,2}):?(\d{2})?$/.exec(text);
	if (m) return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));

	return text.includes('/') ? zoneOffset(text, referenceMs) : null;
}

function applyTime(st: State, h: string, i?: string, s?: string, frac?: string, meridian?: string): boolean {
	let hour = Number(h);
	if (meridian) {
		if (hour < 1 || hour > 12) return false;
		hour = hour % 12 + (meridian[0].toLowerCase() === 'p' ? 12 : 0);
	}
	const minute = Number(i ?? 0), second = Number(s ?? 0);
	if (hour > 24 || minute > 59 || second > 60) return false;
	st.h = hour;
	st.i = minute;
	st.s = second;
	st.ms = frac ? Math.floor(Number('0.' + frac) * 1000) : 0;

	return true;
}

function applyDate(st: State, y: string | undefined, m: string, d: string, now: Date): boolean {
	const month = Number(m), day = Number(d);
	if (month < 1 || month > 12 || day < 1 || day > 31) return false;
	let year = y === undefined ? now.getFullYear() : Number(y);
	if (y !== undefined && y.length <= 2) year += year < 70 ? 2000 : 1900;
	st.y = year;
	st.m = month;
	st.d = day;
	if (st.h === undefined) { st.h = 0; st.i = 0; st.s = 0; st.ms = 0; }

	return true;
}

const TIME = String.raw`(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,:](\d+))?)?(?:\s*([ap])\.?m\.?)?`;
const MERIDIAN = String.raw`(\d{1,2})\s*([ap])\.?m\.?`;
const ZONE = String.raw`(z|utc|gmt|[a-z]{3,4}|[+-]\d{1,2}(?::?\d{2})?|[A-Za-z]+\/[A-Za-z_+\-0-9]+(?:\/[A-Za-z_+\-0-9]+)?)`;

type Matcher = [RegExp, (m: RegExpExecArray, st: State, now: Date) => boolean];

const MATCHERS: Matcher[] = [
	[/^@(-?\d+)/, (m, st) => { st.epoch = Number(m[1]); return true; }],
	[new RegExp(String.raw`^(\d{4})-(\d{2})-(\d{2})[T ]${TIME}`, 'i'), (m, st, now) => applyTime(st, m[4], m[5], m[6], m[7], m[8]) && applyDate(st, m[1], m[2], m[3], now)],
	[/^(\d{4})(\d{2})(\d{2})T?(\d{2}):?(\d{2}):?(\d{2})/, (m, st, now) => applyTime(st, m[4], m[5], m[6]) && applyDate(st, m[1], m[2], m[3], now)],
	[/^(\d{4})-(\d{1,2})-(\d{1,2})/, (m, st, now) => applyDate(st, m[1], m[2], m[3], now)],
	[/^(\d{4})\/(\d{1,2})\/(\d{1,2})/, (m, st, now) => applyDate(st, m[1], m[2], m[3], now)],
	[/^(\d{4})(\d{2})(\d{2})(?!\d)/, (m, st, now) => applyDate(st, m[1], m[2], m[3], now)],
	[/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d)/, (m, st, now) => applyDate(st, m[3], m[1], m[2], now)],
	[/^(\d{1,2})\/(\d{1,2})(?![\d/])/, (m, st, now) => applyDate(st, undefined, m[1], m[2], now)],
	[/^(\d{1,2})[-.](\d{1,2})[-.](\d{4})(?!\d)/, (m, st, now) => applyDate(st, m[3], m[2], m[1], now)],
	[/^(\d{1,2})\.(\d{1,2})\.(\d{2})(?!\d)/, (m, st, now) => applyDate(st, m[3], m[2], m[1], now)],
	[/^(\d{4})-(\d{2})(?![\d-])/, (m, st, now) => applyDate(st, m[1], m[2], '1', now)],
	[new RegExp(String.raw`^(\d{1,2})(?:st|nd|rd|th)?[ .\-]*${MONTH_RE}(?:[ .,\-]*(\d{4}))?(?![a-z])`, 'i'), (m, st, now) => applyDate(st, m[3], String(monthIndex(m[2]) + 1), m[1], now)],
	[new RegExp(String.raw`^${MONTH_RE}[ .\-]*(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?(?![\d:])`, 'i'), (m, st, now) => applyDate(st, m[3], String(monthIndex(m[1]) + 1), m[2], now)],
	[new RegExp(String.raw`^${MONTH_RE}[ ,\-]*(\d{4})(?!\d)`, 'i'), (m, st, now) => applyDate(st, m[2], String(monthIndex(m[1]) + 1), '1', now)],
	[new RegExp(String.raw`^${MONTH_RE}(?![a-z])`, 'i'), (m, st, now) => applyDate(st, undefined, String(monthIndex(m[1]) + 1), String(now.getDate()), now)],
	[new RegExp(`^${TIME}`, 'i'), (m, st) => applyTime(st, m[1], m[2], m[3], m[4], m[5])],
	[new RegExp(`^${MERIDIAN}`, 'i'), (m, st) => applyTime(st, m[1], undefined, undefined, undefined, m[2])],
	[/^t?(\d{2})(\d{2})(\d{2})?(?!\d)/i, (m, st) => applyTime(st, m[1], m[2], m[3])],
	[/^now(?![a-z])/i, () => true],
	[/^(today|midnight)(?![a-z])/i, (_, st) => applyTime(st, '0')],
	[/^noon(?![a-z])/i, (_, st) => applyTime(st, '12')],
	[/^tomorrow(?![a-z])/i, (_, st) => { st.rel.d += 1; return applyTime(st, '0'); }],
	[/^yesterday(?![a-z])/i, (_, st) => { st.rel.d -= 1; return applyTime(st, '0'); }],
	[/^(first|last) day of(?![a-z])/i, (m, st) => { st.firstLastDayOf = m[1].toLowerCase() as 'first' | 'last'; return true; }],
	[new RegExp(String.raw`^(next|last|previous|this)\s+${DAY_RE}(?![a-z])`, 'i'), (m, st) => { st.weekday = { index: dayIndex(m[2]), behavior: NUMBER_WORDS[m[1].toLowerCase()] }; return applyTime(st, '0'); }],
	[new RegExp(String.raw`^${DAY_RE}(?![a-z])`, 'i'), (m, st) => { st.weekday = { index: dayIndex(m[1]), behavior: 0 }; return applyTime(st, '0'); }],
	[new RegExp(String.raw`^([+-]?\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|next|last|previous|this)\s*${UNIT_RE}(\s+ago)?(?![a-z])`, 'i'), (m, st) => {
		const raw = m[1].toLowerCase();
		let amount = raw in NUMBER_WORDS ? NUMBER_WORDS[raw] : Number(raw);
		if (m[3]) amount = -amount;
		const unit = m[2].toLowerCase();
		if (unit.startsWith('sec')) st.rel.s += amount;
		else if (unit.startsWith('min')) st.rel.i += amount;
		else if (unit === 'hour') st.rel.h += amount;
		else if (unit === 'day' || unit === 'weekday') st.rel.d += amount;
		else if (unit === 'week') st.rel.d += amount * 7;
		else if (unit.startsWith('fort')) st.rel.d += amount * 14;
		else if (unit === 'month') st.rel.m += amount;
		else if (unit === 'year') st.rel.y += amount;
		else if (unit.startsWith('msec') || unit.startsWith('milli')) st.rel.ms += amount;
		else st.rel.ms += amount / 1000;

		return true;
	}],
	[new RegExp(`^${ZONE}(?![a-z0-9])`, 'i'), (m, st, now) => {
		const offset = parseZone(m[1], now.getTime());
		if (offset === null) return false;
		st.tz = offset;

		return true;
	}],
];

function parse(input: string, now: Date): State | null {
	const st: State = { rel: { y: 0, m: 0, d: 0, h: 0, i: 0, s: 0, ms: 0 } };
	let rest = input.trim();
	if (rest === '' || rest.includes('\0')) return null;

	while (rest !== '') {
		let matched = false;
		for (const [re, apply] of MATCHERS) {
			const m = re.exec(rest);
			if (!m) continue;
			if (!apply(m, st, now)) return null;
			rest = rest.slice(m[0].length).replace(/^[\s,]+/, '');
			matched = true;
			break;
		}
		if (!matched) return null;
	}

	return st;
}

function resolve(st: State, now: Date): number {
	if (st.epoch !== undefined)
		return st.epoch * 1000;

	let y = st.y ?? now.getFullYear();
	let m = st.m ?? now.getMonth() + 1;
	let d = st.d ?? now.getDate();
	const h = st.h ?? now.getHours(), i = st.i ?? now.getMinutes(), s = st.s ?? now.getSeconds();
	const ms = st.ms ?? (st.h === undefined ? now.getMilliseconds() : 0);

	if (st.weekday) {
		const base = new Date(y, m - 1, d);
		let diff = (st.weekday.index - base.getDay() + 7) % 7;
		if (st.weekday.behavior > 0 && diff === 0) diff = 7;
		if (st.weekday.behavior < 0) diff = diff === 0 ? -7 : diff - 7;
		d += diff;
	}

	m += st.rel.m;
	y += st.rel.y;
	if (st.firstLastDayOf === 'first') d = 1;
	if (st.firstLastDayOf === 'last') d = new Date(y, m, 0).getDate();

	const build = st.tz === undefined
		? (yy: number, mm: number, dd: number, hh: number, ii: number, ss: number, mss: number) => new Date(yy, mm - 1, dd, hh, ii, ss, mss).getTime()
		: (yy: number, mm: number, dd: number, hh: number, ii: number, ss: number, mss: number) => Date.UTC(yy, mm - 1, dd, hh, ii, ss, mss) - (st.tz as number) * 60000;

	// JS normalises overflowing fields the same way mktime does.
	return build(y, m, d + st.rel.d, h + st.rel.h, i + st.rel.i, s + st.rel.s, ms + Math.round(st.rel.ms));
}

// Like strtotime, but in milliseconds; also reports the literal y/m/d like date_parse.
export function parseDate(input: string, now = new Date()): ParsedDate | null {
	const st = parse(input, now);
	if (!st) return null;

	const time = resolve(st, now);

	return Number.isFinite(time) ? { y: st.y, m: st.m, d: st.d, time } : null;
}

export function checkdate(month: number, day: number, year: number): boolean {
	if (month < 1 || month > 12 || day < 1 || year < 1 || year > 32767) return false;

	return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const TOKEN_PATTERNS: Record<string, string> = {
	d: String.raw`\d{1,2}`, j: String.raw`\d{1,2}`, D: '[A-Za-z]{3}', l: '[A-Za-z]+', S: '(?:st|nd|rd|th)', z: String.raw`\d{1,3}`,
	F: '[A-Za-z]+', M: '[A-Za-z]{3}', m: String.raw`\d{1,2}`, n: String.raw`\d{1,2}`, Y: String.raw`\d{4}`, y: String.raw`\d{2}`,
	a: '(?:[aApP][mM])', A: '(?:[aApP][mM])', g: String.raw`\d{1,2}`, h: String.raw`\d{1,2}`, G: String.raw`\d{1,2}`, H: String.raw`\d{1,2}`,
	i: String.raw`\d{2}`, s: String.raw`\d{2}`, v: String.raw`\d{3}`, u: String.raw`\d{1,6}`,
	e: String.raw`(?:[A-Za-z]+(?:\/[A-Za-z_+\-0-9]+)*|[+-]\d{2}:?\d{2})`, T: String.raw`(?:[A-Za-z]+|[+-]\d{2}:?\d{2})`,
	O: String.raw`[+-]\d{4}`, P: String.raw`[+-]\d{2}:\d{2}`, p: String.raw`(?:Z|[+-]\d{2}:\d{2})`, U: String.raw`-?\d+`,
	' ': String.raw`[ \t  ]*`, '?': '.', '#': '[;:/.,\\-()]',
};

export interface FormattedDate {
	date: Date;
	zone: string;
	offset: number;
}

// DateTime::createFromFormat, always in "!" (reset) mode.
export function createFromFormat(format: string, value: string, utc: boolean): FormattedDate | null {
	const fields: Record<string, string> = {};
	const captures: string[] = [];
	let regex = '';
	let allowTrailing = false;

	for (let i = 0; i < format.length; i++) {
		const ch = format[i];
		if (ch === '\\') regex += escapeRegex(format[++i] ?? '');
		else if (ch === '!' || ch === '|') continue;
		else if (ch === '+') allowTrailing = true;
		else if (ch === '*') regex += String.raw`[^\s;:/.,\-()]*`;
		else if (ch in TOKEN_PATTERNS) {
			captures.push(ch);
			regex += `(${TOKEN_PATTERNS[ch]})`;
		} else regex += escapeRegex(ch);
	}

	const m = new RegExp(`^${regex}${allowTrailing ? '' : '$'}`).exec(value);
	if (!m || value.includes('\0')) return null;
	captures.forEach((token, idx) => { fields[token] = m[idx + 1]; });

	let y = 1970, mo = 1, d = 1, h = 0, mi = 0, s = 0, ms = 0;
	let zone = 'UTC', offset = 0;
	if ('Y' in fields) y = Number(fields.Y);
	if ('y' in fields) y = Number(fields.y) + (Number(fields.y) < 70 ? 2000 : 1900);
	if ('m' in fields) mo = Number(fields.m);
	if ('n' in fields) mo = Number(fields.n);
	if ('F' in fields) mo = monthIndex(fields.F) + 1;
	if ('M' in fields) mo = monthIndex(fields.M) + 1;
	if ('d' in fields) d = Number(fields.d);
	if ('j' in fields) d = Number(fields.j);
	if ('z' in fields) { mo = 1; d = Number(fields.z) + 1; }
	if ('G' in fields) h = Number(fields.G);
	if ('H' in fields) h = Number(fields.H);
	if ('g' in fields || 'h' in fields) {
		h = Number(fields.g ?? fields.h) % 12;
		if (/p/i.test(fields.a ?? fields.A ?? '')) h += 12;
	}
	if ('i' in fields) mi = Number(fields.i);
	if ('s' in fields) s = Number(fields.s);
	if ('v' in fields) ms = Number(fields.v);
	if ('u' in fields) ms = Math.floor(Number(fields.u.padEnd(6, '0')) / 1000);
	if (mo < 1 || mo > 12 || h > 24 || mi > 59 || s > 60 || ('F' in fields && mo === 0) || ('M' in fields && mo === 0)) return null;

	const zoneText = fields.e ?? fields.T ?? fields.O ?? fields.P ?? fields.p;
	if (zoneText !== undefined) {
		const parsed = parseZone(zoneText, Date.UTC(y, mo - 1, d, h, mi, s));
		if (parsed === null) return null;
		zone = zoneText;
		offset = parsed;
	}

	let time: number;
	if ('U' in fields) time = Number(fields.U) * 1000;
	else if (utc || zoneText !== undefined) time = Date.UTC(y, mo - 1, d, h, mi, s, ms) - offset * 60000;
	else time = new Date(y, mo - 1, d, h, mi, s, ms).getTime();

	return Number.isFinite(time) ? { date: new Date(time), zone, offset } : null;
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
const pad = (n: number, width = 2): string => String(Math.abs(n)).padStart(width, '0');

function formatOffset(offset: number, colon: boolean): string {
	const sign = offset < 0 ? '-' : '+';
	const abs = Math.abs(offset);

	return `${sign}${pad(Math.floor(abs / 60))}${colon ? ':' : ''}${pad(abs % 60)}`;
}

// DateTime::format for a date parsed by createFromFormat.
export function formatDate(format: string, { date, zone, offset }: FormattedDate): string {
	const local = new Date(date.getTime() + offset * 60000);
	const y = local.getUTCFullYear(), mo = local.getUTCMonth() + 1, d = local.getUTCDate();
	const h = local.getUTCHours(), mi = local.getUTCMinutes(), s = local.getUTCSeconds(), ms = local.getUTCMilliseconds();
	const dow = local.getUTCDay();
	const startOfYear = Date.UTC(y, 0, 1);
	const dayOfYear = Math.floor((Date.UTC(y, mo - 1, d) - startOfYear) / 86400000);
	const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
	const isoWeek = () => {
		const target = new Date(Date.UTC(y, mo - 1, d + 3 - ((dow + 6) % 7)));
		const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));

		return [target.getUTCFullYear(), 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)];
	};
	const cap = (w: string) => w[0].toUpperCase() + w.slice(1);

	let out = '';
	for (let i = 0; i < format.length; i++) {
		const ch = format[i];
		switch (ch) {
			case '\\': out += format[++i] ?? ''; break;
			case 'd': out += pad(d); break;
			case 'j': out += d; break;
			case 'D': out += cap(DAYS[dow].slice(0, 3)); break;
			case 'l': out += cap(DAYS[dow]); break;
			case 'N': out += dow === 0 ? 7 : dow; break;
			case 'S': out += d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th'; break;
			case 'w': out += dow; break;
			case 'z': out += dayOfYear; break;
			case 'W': out += pad(isoWeek()[1]); break;
			case 'F': out += cap(MONTHS[mo - 1]); break;
			case 'm': out += pad(mo); break;
			case 'M': out += cap(MONTHS[mo - 1].slice(0, 3)); break;
			case 'n': out += mo; break;
			case 't': out += new Date(Date.UTC(y, mo, 0)).getUTCDate(); break;
			case 'L': out += isLeap ? 1 : 0; break;
			case 'o': out += isoWeek()[0]; break;
			case 'Y': out += (y < 0 ? '-' : '') + pad(y, 4); break;
			case 'y': out += pad(y % 100); break;
			case 'a': out += h < 12 ? 'am' : 'pm'; break;
			case 'A': out += h < 12 ? 'AM' : 'PM'; break;
			case 'g': out += h % 12 || 12; break;
			case 'G': out += h; break;
			case 'h': out += pad(h % 12 || 12); break;
			case 'H': out += pad(h); break;
			case 'i': out += pad(mi); break;
			case 's': out += pad(s); break;
			case 'u': out += pad(ms * 1000, 6); break;
			case 'v': out += pad(ms, 3); break;
			case 'e': out += zone; break;
			case 'T': out += /\//.test(zone) ? formatOffset(offset, true) : zone; break;
			case 'I': out += 0; break;
			case 'O': out += formatOffset(offset, false); break;
			case 'P': out += formatOffset(offset, true); break;
			case 'p': out += offset === 0 ? 'Z' : formatOffset(offset, true); break;
			case 'Z': out += offset * 60; break;
			case 'U': out += Math.floor(date.getTime() / 1000); break;
			case 'c': out += formatDate('Y-m-d\\TH:i:sP', { date, zone, offset }); break;
			case 'r': out += formatDate('D, d M Y H:i:s O', { date, zone, offset }); break;
			default: out += ch;
		}
	}

	return out;
}

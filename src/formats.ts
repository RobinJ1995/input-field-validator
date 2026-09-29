// Format checks behind email, url, uuid, ulid, ip, mac_address and timezone.
import { mbStrlen } from './php';
import { ZONES, ZONES_WITH_BC, COUNTRIES } from './timezones';

const ATOM = String.raw`[\x21\x23-\x27\x2A\x2B\x2D\x2F-\x39\x3D\x3F\x5E-\x7E]`;
const UNICODE_ATOM = String.raw`[\x21\x23-\x27\x2A\x2B\x2D\x2F-\x39\x3D\x3F\x5E-\x7E\u{80}-\u{10FFFF}]`;
const QUOTED = String.raw`"(?:[\x01-\x08\x0B\x0C\x0E-\x1F\x21\x23-\x5B\x5D-\x7F]|\\[\x00-\x7F])*"`;
const HOSTNAME = String.raw`(?!.*[^.]{64,})(?:(?:(?:xn--)?[a-z0-9]+(?:-+[a-z0-9]+)*\.){1,126}){1,}(?:(?:[a-z][a-z0-9]*)|(?:(?:xn--)[a-z0-9]+))(?:-+[a-z0-9]+)*`;
const IPV4 = String.raw`(?:(?:25[0-5])|(?:2[0-4][0-9])|(?:1[0-9]{2})|(?:[1-9]?[0-9]))(?:\.(?:(?:25[0-5])|(?:2[0-4][0-9])|(?:1[0-9]{2})|(?:[1-9]?[0-9]))){3}`;
const EMAIL_LITERAL = String.raw`\[(?:(?:IPv6:(?:(?:[a-f0-9]{1,4}(?::[a-f0-9]{1,4}){7})|(?:(?!(?:.*[a-f0-9][:\]]){7,})(?:[a-f0-9]{1,4}(?::[a-f0-9]{1,4}){0,5})?::(?:[a-f0-9]{1,4}(?::[a-f0-9]{1,4}){0,5})?)))|(?:(?:IPv6:(?:(?:[a-f0-9]{1,4}(?::[a-f0-9]{1,4}){5}:)|(?:(?!(?:.*[a-f0-9]:){5,})(?:[a-f0-9]{1,4}(?::[a-f0-9]{1,4}){0,3})?::(?:[a-f0-9]{1,4}(?::[a-f0-9]{1,4}){0,3}:)?)))?${IPV4}))\]`;

// PHP's FILTER_VALIDATE_EMAIL regex, with an optional unicode local part.
const filterEmailRegex = (atom: string, flags: string) => new RegExp(
	String.raw`^(?!(?:(?:\x22?\x5C[\x00-\x7E]\x22?)|(?:\x22?[^\x5C\x22]\x22?)){255,})(?!(?:(?:\x22?\x5C[\x00-\x7E]\x22?)|(?:\x22?[^\x5C\x22]\x22?)){65,}@)(?:${atom}+|${QUOTED})(?:\.(?:${atom}+|${QUOTED}))*@(?:${HOSTNAME}|${EMAIL_LITERAL})$`,
	flags,
);
const FILTER_EMAIL = filterEmailRegex(ATOM, 'i');
const FILTER_EMAIL_UNICODE = filterEmailRegex(UNICODE_ATOM, 'iu');

const RFC_LOCAL = /^[^\s@"(),:;<>[\]\\]+(?:\.[^\s@"(),:;<>[\]\\]+)*$/u;
const RFC_QUOTED_LOCAL = /^"(?:[^"\\\r\n]|\\.)*"$/u;
const RFC_LABEL = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?$/u;

interface RfcResult {
	valid: boolean;
	warnings: boolean;
}

function rfcEmail(value: string): RfcResult {
	let warnings = false;
	const trimmed = value.replace(/\s+$/u, '');
	if (trimmed !== value) warnings = true;

	const at = trimmed.lastIndexOf('@');
	if (at <= 0 || at === trimmed.length - 1) return { valid: false, warnings };
	const local = trimmed.slice(0, at), domain = trimmed.slice(at + 1);

	if (RFC_QUOTED_LOCAL.test(local)) warnings = true;
	else if (!RFC_LOCAL.test(local)) return { valid: false, warnings };
	if (mbStrlen(local) > 64 || mbStrlen(trimmed) > 254) warnings = true;

	if (domain.startsWith('[') && domain.endsWith(']')) {
		const inner = domain.slice(1, -1);
		const ok = inner.startsWith('IPv6:') ? isIpv6(inner.slice(5)) : isIpv4(inner);

		return { valid: ok, warnings: true };
	}

	const labels = domain.split('.');
	if (!labels.every(l => RFC_LABEL.test(l))) return { valid: false, warnings };
	if (labels.some(l => l.length > 63)) warnings = true;
	if (labels.length < 2) warnings = true;

	return { valid: true, warnings };
}

export function isEmail(value: string, options: string[]): boolean {
	const checks = options.length ? Array.from(new Set(options)) : ['rfc'];

	return checks.every(check => {
		switch (check) {
			case 'strict': {
				const result = rfcEmail(value);

				return result.valid && !result.warnings;
			}
			case 'filter': return FILTER_EMAIL.test(value);
			case 'filter_unicode': return FILTER_EMAIL_UNICODE.test(value);
			case 'dns':
			case 'spoof':
				throw new Error(`The email:${check} check is not supported.`);
			default: return rfcEmail(value).valid;
		}
	});
}

const DEFAULT_PROTOCOLS = String.raw`aaa|aaas|about|acap|acct|acd|acr|adiumxtra|adt|afp|afs|aim|amss|android|appdata|apt|ark|attachment|aw|barion|beshare|bitcoin|bitcoincash|blob|bolo|browserext|calculator|callto|cap|cast|casts|chrome|chrome-extension|cid|coap|coap\+tcp|coap\+ws|coaps|coaps\+tcp|coaps\+ws|com-eventbrite-attendee|content|conti|crid|cvs|dab|data|dav|diaspora|dict|did|dis|dlna-playcontainer|dlna-playsingle|dns|dntp|dpp|drm|drop|dtn|dvb|ed2k|elsi|example|facetime|fax|feed|feedready|file|filesystem|finger|first-run-pen-experience|fish|fm|ftp|fuchsia-pkg|geo|gg|git|gizmoproject|go|gopher|graph|gtalk|h323|ham|hcap|hcp|http|https|hxxp|hxxps|hydrazone|iax|icap|icon|im|imap|info|iotdisco|ipn|ipp|ipps|irc|irc6|ircs|iris|iris\.beep|iris\.lwz|iris\.xpc|iris\.xpcs|isostore|itms|jabber|jar|jms|keyparc|lastfm|ldap|ldaps|leaptofrogans|lorawan|lvlt|magnet|mailserver|mailto|maps|market|message|mid|mms|modem|mongodb|moz|ms-access|ms-browser-extension|ms-calculator|ms-drive-to|ms-enrollment|ms-excel|ms-eyecontrolspeech|ms-gamebarservices|ms-gamingoverlay|ms-getoffice|ms-help|ms-infopath|ms-inputapp|ms-lockscreencomponent-config|ms-media-stream-id|ms-mixedrealitycapture|ms-mobileplans|ms-officeapp|ms-people|ms-project|ms-powerpoint|ms-publisher|ms-restoretabcompanion|ms-screenclip|ms-screensketch|ms-search|ms-search-repair|ms-secondary-screen-controller|ms-secondary-screen-setup|ms-settings|ms-settings-airplanemode|ms-settings-bluetooth|ms-settings-camera|ms-settings-cellular|ms-settings-cloudstorage|ms-settings-connectabledevices|ms-settings-displays-topology|ms-settings-emailandaccounts|ms-settings-language|ms-settings-location|ms-settings-lock|ms-settings-nfctransactions|ms-settings-notifications|ms-settings-power|ms-settings-privacy|ms-settings-proximity|ms-settings-screenrotation|ms-settings-wifi|ms-settings-workplace|ms-spd|ms-sttoverlay|ms-transit-to|ms-useractivityset|ms-virtualtouchpad|ms-visio|ms-walk-to|ms-whiteboard|ms-whiteboard-cmd|ms-word|msnim|msrp|msrps|mss|mtqp|mumble|mupdate|mvn|news|nfs|ni|nih|nntp|notes|ocf|oid|onenote|onenote-cmd|opaquelocktoken|openpgp4fpr|pack|palm|paparazzi|payto|pkcs11|platform|pop|pres|prospero|proxy|pwid|psyc|pttp|qb|query|redis|rediss|reload|res|resource|rmi|rsync|rtmfp|rtmp|rtsp|rtsps|rtspu|s3|secondlife|service|session|sftp|sgn|shttp|sieve|simpleledger|sip|sips|skype|smb|sms|smtp|snews|snmp|soap\.beep|soap\.beeps|soldat|spiffe|spotify|ssh|steam|stun|stuns|submit|svn|tag|teamspeak|tel|teliaeid|telnet|tftp|tg|things|thismessage|tip|tn3270|tool|ts3server|turn|turns|tv|udp|unreal|urn|ut2004|v-event|vemmi|ventrilo|videotex|vnc|view-source|wais|webcal|wpid|ws|wss|wtai|wyciwyg|xcon|xcon-userid|xfire|xmlrpc\.beep|xmlrpc\.beeps|xmpp|xri|ymsgr|z39\.50|z39\.50r|z39\.50s`;

const IPV6_URL = String.raw`\[(?:(?:(?:[0-9a-f]{1,4}:){6}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|${IPV4}))|(?:::(?:[0-9a-f]{1,4}:){5}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|${IPV4}))|(?:(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|${IPV4}))|(?:(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|${IPV4}))|(?:(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|${IPV4}))|(?:(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|${IPV4}))|(?:(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|${IPV4}))|(?:(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4})|(?:(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::))\]`;

const urlRegexCache = new Map<string, RegExp>();

// Str::isUrl's pattern.
function urlRegex(protocols: string[]): RegExp {
	const list = protocols.length ? protocols.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') : DEFAULT_PROTOCOLS;
	let regex = urlRegexCache.get(list);
	if (!regex) {
		const pct = String.raw`%[0-9A-Fa-f]{2}`;
		regex = new RegExp(String.raw`^(?:${list})://(?:(?:(?:[_.\p{L}\p{N}-]|${pct})+:)?(?:(?:[_.\p{L}\p{N}-]|${pct})+)@)?(?:(?:(?:(?:[\p{L}\p{N}\p{S}\p{M}\-_]+\.)+(?:(?:xn--[a-z0-9-]+)|(?:[\p{L}\p{N}\p{M}]+)))|[a-z0-9\-_]+)\.?|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|${IPV6_URL})(?::[0-9]+)?(?:/(?:[\p{L}\p{N}\-._~!$&'()*+,;=:@]|${pct})*)*(?:\?(?:[\p{L}\p{N}\-._~!$&'\[\]()*+,;=:@/?]|${pct})*)?(?:#(?:[\p{L}\p{N}\-._~!$&'()*+,;=:@/?]|${pct})*)?$`, 'iu');
		urlRegexCache.set(list, regex);
	}

	return regex;
}

export const isUrl = (value: string, protocols: string[] = []): boolean => urlRegex(protocols).test(value);

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export function isUuid(value: string, version: number | 'max' | null = null): boolean {
	if (!UUID.test(value)) return false;
	if (version === null) return true;

	const nil = /^[0-]+$/.test(value), max = /^[f-]+$/i.test(value);
	if (version === 0) return nil;
	if (version === 'max') return max;
	if (nil || max) return false;

	return parseInt(value[14], 16) === version;
}

export const isUlid = (value: string): boolean => /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i.test(value);

export const isIpv4 = (value: string): boolean => new RegExp(`^${IPV4}$`).test(value);

const IPV6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9]))$/;

export const isIpv6 = (value: string): boolean => IPV6.test(value);

export const isMacAddress = (value: string): boolean =>
	/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(value)
	|| /^([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}$/.test(value)
	|| /^([0-9A-Fa-f]{4}\.){2}[0-9A-Fa-f]{4}$/.test(value);

const GROUPS = ['AFRICA', 'AMERICA', 'ANTARCTICA', 'ARCTIC', 'ASIA', 'ATLANTIC', 'AUSTRALIA', 'EUROPE', 'INDIAN', 'PACIFIC'];

// timezone_identifiers_list()
export function timezoneIdentifiers(group: string, country?: string): string[] {
	if (group === 'PER_COUNTRY') return COUNTRIES[country ?? ''] ?? [];
	if (group === 'UTC') return ['UTC'];
	if (group === 'ALL') return ZONES;
	if (group === 'ALL_WITH_BC') return ZONES_WITH_BC;
	if (!GROUPS.includes(group))
		throw new Error(`Unknown timezone group ${group}.`);

	const prefix = `${group[0]}${group.slice(1).toLowerCase()}/`;

	return ZONES.filter(z => z.startsWith(prefix));
}

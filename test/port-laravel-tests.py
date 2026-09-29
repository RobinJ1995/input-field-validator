#!/usr/bin/env python3
"""Extracts `new Validator(...)` + assert pairs from Laravel's ValidationValidatorTest.php into JSON."""
import json
import re
import sys

SRC = sys.argv[1]
OUT = sys.argv[2]


class Unsupported(Exception):
    pass


class Parser:
    def __init__(self, text, variables):
        self.s = text
        self.i = 0
        self.vars = variables

    def skip(self):
        while self.i < len(self.s):
            c = self.s[self.i]
            if c.isspace():
                self.i += 1
            elif self.s.startswith('//', self.i):
                nl = self.s.find('\n', self.i)
                self.i = len(self.s) if nl == -1 else nl
            elif self.s.startswith('/*', self.i):
                self.i = self.s.index('*/', self.i) + 2
            else:
                break

    def peek(self, n=1):
        self.skip()
        return self.s[self.i:self.i + n]

    def expect(self, tok):
        self.skip()
        if not self.s.startswith(tok, self.i):
            raise Unsupported(f'expected {tok!r} at {self.s[self.i:self.i+20]!r}')
        self.i += len(tok)

    def value(self):
        self.skip()
        c = self.s[self.i]
        if c == '[':
            return self.array()
        if c == "'":
            return self.single_string()
        if c == '"':
            return self.double_string()
        m = re.match(r'-?\d+\.\d+(?:[eE][+-]?\d+)?|-?\.\d+|-?\d+[eE][+-]?\d+', self.s[self.i:])
        if m:
            self.i += m.end()
            return float(m.group(0))
        m = re.match(r'-?\d+', self.s[self.i:])
        if m and not re.match(r'-?\d+\s*=>', self.s[self.i:]) or (m and self.s[self.i + m.end():self.i + m.end() + 1] not in ('.',)):
            if m:
                self.i += m.end()
                return int(m.group(0))
        m = re.match(r'(true|false|null)\b', self.s[self.i:])
        if m:
            self.i += m.end()
            return {'true': True, 'false': False, 'null': None}[m.group(1)]
        m = re.match(r'new\s+(DateTime|DateTimeImmutable|Carbon)\s*(\(\s*(\'[^\']*\')?\s*\))?', self.s[self.i:])
        if m:
            self.i += m.end()
            arg = m.group(3)
            return {'__date__': arg[1:-1] if arg else None}
        m = re.match(r'str_repeat\(\s*(\'[^\']*\')\s*,\s*(\d+)\s*\)', self.s[self.i:])
        if m:
            self.i += m.end()
            return m.group(1)[1:-1] * int(m.group(2))
        m = re.match(r'\$(\w+)\b', self.s[self.i:])
        if m and m.group(1) in self.vars and not self.s[self.i + m.end():].lstrip().startswith(('->', '[')):
            self.i += m.end()
            return self.vars[m.group(1)]
        raise Unsupported(f'value at {self.s[self.i:self.i+30]!r}')

    def single_string(self):
        self.i += 1
        out = ''
        while True:
            c = self.s[self.i]
            if c == '\\' and self.s[self.i + 1] in ("'", '\\'):
                out += self.s[self.i + 1]
                self.i += 2
            elif c == "'":
                self.i += 1
                return out
            else:
                out += c
                self.i += 1

    def double_string(self):
        self.i += 1
        out = ''
        simple = {'n': '\n', 'r': '\r', 't': '\t', 'v': '\v', 'e': '\x1b', 'f': '\f', '\\': '\\', '$': '$', '"': '"'}
        while True:
            c = self.s[self.i]
            if c == '\\':
                n = self.s[self.i + 1]
                if n in simple:
                    out += simple[n]
                    self.i += 2
                elif n == 'x':
                    m = re.match(r'x([0-9A-Fa-f]{1,2})', self.s[self.i + 1:])
                    out += chr(int(m.group(1), 16))
                    self.i += 1 + m.end()
                elif n == 'u':
                    m = re.match(r'u\{([0-9A-Fa-f]+)\}', self.s[self.i + 1:])
                    out += chr(int(m.group(1), 16))
                    self.i += 1 + m.end()
                elif n in '01234567':
                    m = re.match(r'([0-7]{1,3})', self.s[self.i + 1:])
                    out += chr(int(m.group(1), 8))
                    self.i += 1 + m.end()
                else:
                    out += '\\' + n
                    self.i += 2
            elif c == '"':
                self.i += 1
                return out
            elif c == '$':
                raise Unsupported('interpolation')
            else:
                out += c
                self.i += 1

    def array(self):
        self.expect('[')
        items = []
        keyed = False
        while True:
            if self.peek() == ']':
                self.i += 1
                break
            v = self.value()
            if self.peek(2) == '=>':
                self.i += 2
                keyed = True
                k = v
                v = self.value()
                items.append((k, v))
            else:
                items.append((None, v))
            if self.peek() == ',':
                self.i += 1
            elif self.peek() == ']':
                self.i += 1
                break
            else:
                raise Unsupported('array syntax')
        if not keyed:
            return [v for _, v in items]
        result = {}
        next_index = 0
        for k, v in items:
            if k is None:
                k = next_index
            if isinstance(k, bool) or k is None or isinstance(k, (list, dict, float)):
                raise Unsupported('weird key')
            if isinstance(k, str) and re.fullmatch(r'-?\d+', k) and not (len(k) > 1 and k.startswith('0')):
                k = int(k)
            if isinstance(k, int):
                next_index = max(next_index, k + 1)
            result[str(k)] = v
        if list(result.keys()) == [str(i) for i in range(len(result))]:
            return [result[str(i)] for i in range(len(result))]
        return result


def split_args(text):
    """Splits the argument list of a call, respecting nesting and strings."""
    args, depth, cur, i, quote = [], 0, '', 0, None
    while i < len(text):
        c = text[i]
        if quote:
            cur += c
            if c == '\\':
                cur += text[i + 1]
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in '\'"':
            quote = c
            cur += c
        elif c in '([{':
            depth += 1
            cur += c
        elif c in ')]}':
            depth -= 1
            cur += c
        elif c == ',' and depth == 0:
            args.append(cur)
            cur = ''
        else:
            cur += c
        i += 1
    if cur.strip():
        args.append(cur)
    return args


def find_call(text, start):
    """Returns the text between the parentheses of the call starting at `start` (index of '(')."""
    depth, i, quote = 0, start, None
    while i < len(text):
        c = text[i]
        if quote:
            if c == '\\':
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in '\'"':
            quote = c
        elif c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
            if depth == 0:
                return text[start + 1:i], i + 1
        i += 1
    raise Unsupported('unbalanced')


def parse_expr(text, variables):
    p = Parser(text, variables)
    v = p.value()
    p.skip()
    if p.i != len(p.s):
        raise Unsupported(f'trailing {p.s[p.i:p.i+20]!r}')
    return v


src = open(SRC, encoding='utf-8').read()
cases = []
skipped = 0
method_re = re.compile(r'    public function (test\w+)\(.*?\)\n    \{\n(.*?)\n    \}\n', re.S)

for m in method_re.finditer(src):
    name, body = m.group(1), m.group(2)
    if 'setTestNow' in body or 'date_default_timezone_set' in body and 'UTC' not in body:
        continue
    line_base = src[:m.start()].count('\n') + 3
    assignments = []
    for vm in re.finditer(r'^\s*\$(\w+) = (\[.*?\]);\n', body, re.S | re.M):
        assignments.append((vm.start(), vm.group(1), vm.group(2)))

    def variables_at(position):
        variables = {}
        for start, var_name, expr in assignments:
            if start > position:
                break
            try:
                variables[var_name] = parse_expr(expr, variables)
            except Unsupported:
                variables.pop(var_name, None)
        return variables
    pos = 0
    while True:
        cm = re.search(r'\$(\w+) = new Validator\(', body[pos:])
        if not cm:
            break
        var = cm.group(1)
        call_start = pos + cm.end() - 1
        try:
            inner, after = find_call(body, call_start)
        except Unsupported:
            break
        pos = after
        line = line_base + body[:call_start].count('\n')
        variables = variables_at(call_start)
        args = split_args(inner)
        if not args or args[0].strip() not in ('$trans', '$this->getIlluminateArrayTranslator()'):
            skipped += 1
            continue
        try:
            data = parse_expr(args[1], variables)
            rules = parse_expr(args[2], variables)
            messages = parse_expr(args[3], variables) if len(args) > 3 else None
            attributes = parse_expr(args[4], variables) if len(args) > 4 else None
            if not isinstance(data, (dict, list)) or not isinstance(rules, (dict, list)):
                raise Unsupported('non-array data/rules')
            if isinstance(data, list) and data:
                raise Unsupported('list data')
            if isinstance(rules, list) and rules:
                raise Unsupported('list rules')
        except Unsupported:
            skipped += 1
            continue
        rest = body[after:]
        assertions = []
        for stmt in re.split(r';\s*\n', rest):
            stmt = stmt.strip()
            stmt = re.sub(r'^(//.*\n\s*)+', '', stmt).strip()
            if stmt.startswith('//'):
                continue
            if not stmt:
                continue
            am = re.fullmatch(r'\$this->assert(True|False)\(\$' + var + r'->(passes|fails)\(\)\)', stmt)
            if am:
                truth = am.group(1) == 'True'
                passes = truth if am.group(2) == 'passes' else not truth
                assertions.append({'type': 'passes', 'expected': passes})
                continue
            am = re.fullmatch(r'\$this->assert(Same|Equals)\((.*), \$' + var + r'->validated\(\)\)', stmt, re.S)
            if am:
                try:
                    assertions.append({'type': 'validated', 'expected': parse_expr(am.group(2), variables)})
                except Unsupported:
                    pass
                continue
            am = re.fullmatch(r'\$this->assert(Same|Equals)\((.*), \$' + var + r'->(?:messages|errors)\(\)->keys\(\)\)', stmt, re.S)
            if am:
                try:
                    assertions.append({'type': 'keys', 'expected': parse_expr(am.group(2), variables)})
                except Unsupported:
                    pass
                continue
            am = re.fullmatch(r'\$this->assertCount\((\d+), \$' + var + r'->messages\(\)\)', stmt)
            if am:
                assertions.append({'type': 'count', 'expected': int(am.group(1))})
                continue
            break
        if not assertions:
            skipped += 1
            continue
        case = {'test': name, 'line': line, 'data': data, 'rules': rules, 'assertions': assertions}
        if messages is not None:
            case['messages'] = messages
        if attributes is not None:
            case['attributes'] = attributes
        cases.append(case)


def php_num(v):
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


PROVIDERS = {
    'validUrls': ('testValidateUrlWithValidUrls', lambda r: ({'x': r[0]}, {'x': 'Url'}, [{'type': 'passes', 'expected': True}])),
    'invalidUrls': ('testValidateUrlWithInvalidUrls', lambda r: ({'x': r[0]}, {'x': 'Url'}, [{'type': 'passes', 'expected': False}])),
    'validUuidList': ('testValidateWithValidUuid', lambda r: ({'foo': r[0]}, {'foo': 'uuid'}, [{'type': 'passes', 'expected': True}])),
    'invalidUuidList': ('testValidateWithInvalidUuid', lambda r: ({'foo': r[0]}, {'foo': 'uuid'}, [{'type': 'passes', 'expected': False}])),
    'uuidVersionList': ('testValidateWithUuidWithVersionConstraint', lambda r: ({'foo': r[0]}, {'foo': r[1]}, [{'type': 'passes', 'expected': r[2]}])),
    'multipleOfDataProvider': ('testValidateMultipleOf', lambda r: ({'foo': r[0]}, {'foo': 'multiple_of:' + php_num(r[1])}, [{'type': 'passes', 'expected': r[2]}])),
    'prohibitedRulesData': ('testProhibitedRulesAreConsistent', lambda r: (r[1], r[0], [{'type': 'passes', 'expected': r[2]}])),
    'providesPassingExcludeIfData': ('testExcludeIf', lambda r: (r[1], r[0], [{'type': 'passes', 'expected': True}, {'type': 'validated', 'expected': r[2]}])),
    'providesPassingExcludeData': ('testExclude', lambda r: (r[1], r[0], [{'type': 'passes', 'expected': True}, {'type': 'validated', 'expected': r[2]}])),
    'outsideRangeExponents': ('testItLimitsLengthOfScientificNotationExponent', lambda r: ({'foo': r[0]}, {'foo': 'numeric|min:3'}, [{'type': 'passes', 'expected': False}])),
    'withinRangeExponents': ('testItAllowsScientificNotationWithinRange', lambda r: ({'foo': r[0]}, {'foo': ['numeric', r[1]]}, [{'type': 'passes', 'expected': True}])),
}

for provider, (test, template) in PROVIDERS.items():
    pm = re.search(r'public static function ' + provider + r'\(\)\n    \{\n.*?        return (\[.*?\]);\n    \}\n', src, re.S)
    if not pm:
        print(f'provider {provider} not found', file=sys.stderr)
        continue
    line = src[:pm.start()].count('\n') + 1
    rows = []
    for row_text in split_args(pm.group(1).strip()[1:-1]):
        if not re.sub(r'//[^\n]*', '', row_text).strip():
            continue
        try:
            rows.append(parse_expr(row_text, {}))
        except (Unsupported, IndexError):
            pass
    for row in rows:
        data, rules, assertions = template(row)
        cases.append({'test': test, 'line': line, 'data': data, 'rules': rules, 'assertions': assertions})

json.dump(cases, open(OUT, 'w', encoding='utf-8'), indent='\t', ensure_ascii=False)
print(f'{len(cases)} cases, {skipped} skipped', file=sys.stderr)

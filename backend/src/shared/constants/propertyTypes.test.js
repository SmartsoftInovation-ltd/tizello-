/**
 * Unit tests for the property-type value checks.
 *
 * WHY THIS FILE IS THE MOST SECURITY-RELEVANT ONE HERE. `PROPERTY_TYPES[x].check`
 * is the ONLY thing standing between a client-supplied JSON blob and a
 * project's or a task's `properties` column. Joi deliberately types those
 * values as `Joi.any()` (see project.validator.js and task.validator.js), on
 * the grounds that the real rule depends on a definition that lives in the
 * database — so this table is not one of two defences, it is the only one.
 *
 * Two checks here are not merely validation:
 *
 * - FILES pins `url` to exactly `/uploads/<storedName>`. Without it, a caller
 *   could store any url it liked and every member who opens the project would
 *   fetch it — a tracking pixel at best, and with a `javascript:` or data url,
 *   worse.
 * - URL admits http and https only, for the same reason.
 *
 * The rest pin the boundary cases the comments in `propertyTypes.js` argue
 * for: NaN is a number to `typeof` and survives nothing; `2026-02-31` matches
 * the ISO pattern and is not a date.
 *
 * Pure — no database. Run with `npm test`.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  OPTION_TYPES,
  PROPERTY_TYPES,
  PROPERTY_TYPE_NAMES,
  optionIds,
} from './propertyTypes.js';

/** A stored file name of exactly the shape `shared/middlewares/upload.js` generates. */
const STORED = '0123abcd-0123-0123-0123-0123456789ab.png';
const validFile = (overrides = {}) => ({
  id: '0123abcd-0123-0123-0123-0123456789ab',
  name: 'diagram.png',
  storedName: STORED,
  url: `/uploads/${STORED}`,
  size: 1024,
  mime: 'image/png',
  ...overrides,
});

describe('the table itself', () => {
  it('gives every declared type a check — a type without one accepts anything', () => {
    for (const name of PROPERTY_TYPE_NAMES) {
      assert.equal(typeof PROPERTY_TYPES[name].check, 'function', `${name} has no check`);
      assert.equal(typeof PROPERTY_TYPES[name].hasOptions, 'boolean', `${name} has no hasOptions`);
    }
  });

  it('marks exactly SELECT and MULTI_SELECT as option types', () => {
    // `OPTION_TYPES` drives both DTOs (`options: [] | null`) and the create
    // validator's `Joi.when`. A third entry here would silently let a TEXT
    // property carry swatches nobody renders.
    assert.deepEqual([...OPTION_TYPES].sort(), ['MULTI_SELECT', 'SELECT']);
  });

  it('returns null for an acceptable value and a SENTENCE for a rejected one', () => {
    // The return value is the 422's message, so it has to read as prose — a
    // check that returned `false` or a code would ship "false" to the client.
    assert.equal(PROPERTY_TYPES.TEXT.check('fine'), null);
    assert.equal(typeof PROPERTY_TYPES.TEXT.check(7), 'string');
    assert.ok(PROPERTY_TYPES.TEXT.check(7).length > 3);
  });
});

describe('TEXT', () => {
  it('accepts a string up to 2000 characters and rejects 2001', () => {
    assert.equal(PROPERTY_TYPES.TEXT.check('a'.repeat(2000)), null);
    assert.ok(PROPERTY_TYPES.TEXT.check('a'.repeat(2001)));
  });

  it('accepts the empty string — "cleared" is `null`, which never reaches here', () => {
    assert.equal(PROPERTY_TYPES.TEXT.check(''), null);
  });

  it('rejects a non-string, including a number that would stringify fine', () => {
    assert.ok(PROPERTY_TYPES.TEXT.check(42));
    assert.ok(PROPERTY_TYPES.TEXT.check(['a']));
    assert.ok(PROPERTY_TYPES.TEXT.check({}));
  });
});

describe('NUMBER', () => {
  it('accepts finite numbers including 0 and negatives', () => {
    assert.equal(PROPERTY_TYPES.NUMBER.check(0), null);
    assert.equal(PROPERTY_TYPES.NUMBER.check(-3.5), null);
  });

  it('rejects NaN and Infinity, which `typeof === "number"` would have let through', () => {
    // Neither survives a round trip through JSON: both come back as `null`,
    // so a stored NaN is a value that changes on read.
    assert.ok(PROPERTY_TYPES.NUMBER.check(NaN));
    assert.ok(PROPERTY_TYPES.NUMBER.check(Infinity));
    assert.ok(PROPERTY_TYPES.NUMBER.check(-Infinity));
  });

  it('rejects a numeric string — no coercion', () => {
    assert.ok(PROPERTY_TYPES.NUMBER.check('42'));
  });
});

describe('DATE', () => {
  it('accepts a real YYYY-MM-DD date', () => {
    assert.equal(PROPERTY_TYPES.DATE.check('2026-02-28'), null);
    assert.equal(PROPERTY_TYPES.DATE.check('2024-02-29'), null); // a real leap day
  });

  it('rejects a date that matches the pattern but does not exist', () => {
    // The whole reason `isRealDate` re-parses instead of trusting the regex.
    assert.ok(PROPERTY_TYPES.DATE.check('2026-02-31'));
    assert.ok(PROPERTY_TYPES.DATE.check('2026-13-01'));
    assert.ok(PROPERTY_TYPES.DATE.check('2025-02-29')); // 2025 is not a leap year
  });

  it('rejects a timestamp — a property date is a calendar day', () => {
    assert.ok(PROPERTY_TYPES.DATE.check('2026-02-28T10:00:00Z'));
    assert.ok(PROPERTY_TYPES.DATE.check('2026-2-8'));
  });
});

describe('CHECKBOX', () => {
  it('accepts only real booleans, not their truthy stand-ins', () => {
    assert.equal(PROPERTY_TYPES.CHECKBOX.check(true), null);
    assert.equal(PROPERTY_TYPES.CHECKBOX.check(false), null);
    assert.ok(PROPERTY_TYPES.CHECKBOX.check('true'));
    assert.ok(PROPERTY_TYPES.CHECKBOX.check(1));
    assert.ok(PROPERTY_TYPES.CHECKBOX.check(0));
  });
});

describe('URL', () => {
  it('accepts http and https', () => {
    assert.equal(PROPERTY_TYPES.URL.check('https://example.com/a?b=c'), null);
    assert.equal(PROPERTY_TYPES.URL.check('http://localhost:3000'), null);
  });

  it('rejects every other scheme — this value is rendered as a link', () => {
    // `javascript:` and `data:` are both parseable URLs. Accepting them would
    // make a project property a stored-XSS vector in any client that renders
    // it as an anchor.
    assert.ok(PROPERTY_TYPES.URL.check('javascript:alert(1)'));
    assert.ok(PROPERTY_TYPES.URL.check('data:text/html,<script>x</script>'));
    assert.ok(PROPERTY_TYPES.URL.check('file:///etc/passwd'));
    assert.ok(PROPERTY_TYPES.URL.check('ftp://example.com'));
  });

  it('rejects something that is not a URL at all, without throwing', () => {
    // `new URL` throws; the try/catch around it is what makes this a 422
    // rather than a 500.
    assert.ok(PROPERTY_TYPES.URL.check('example.com'));
    assert.ok(PROPERTY_TYPES.URL.check(''));
    assert.ok(PROPERTY_TYPES.URL.check(7));
  });
});

describe('EMAIL', () => {
  it('accepts an ordinary address and caps at 254 characters', () => {
    assert.equal(PROPERTY_TYPES.EMAIL.check('a@b.co'), null);
    const long = `${'a'.repeat(250)}@b.co`;
    assert.ok(PROPERTY_TYPES.EMAIL.check(long));
  });

  it('is shape-only, deliberately looser than the auth module', () => {
    // A label on a project, not a login: rejecting a real address here costs a
    // user their data entry and buys nothing.
    assert.equal(PROPERTY_TYPES.EMAIL.check('first.last+tag@sub.example.museum'), null);
  });

  it('rejects something with no @ or no dot after it', () => {
    assert.ok(PROPERTY_TYPES.EMAIL.check('not-an-email'));
    assert.ok(PROPERTY_TYPES.EMAIL.check('a@b'));
    assert.ok(PROPERTY_TYPES.EMAIL.check('a b@c.co'));
  });
});

describe('PHONE', () => {
  it('accepts anything non-empty up to 32 characters — no pattern by design', () => {
    // Every phone regex ever written rejects somebody's real number.
    assert.equal(PROPERTY_TYPES.PHONE.check('+880 1712-345678 ext. 4'), null);
    assert.equal(PROPERTY_TYPES.PHONE.check('(555) 010-0000'), null);
  });

  it('rejects the empty string and anything over 32 characters', () => {
    assert.ok(PROPERTY_TYPES.PHONE.check(''));
    assert.ok(PROPERTY_TYPES.PHONE.check('1'.repeat(33)));
  });
});

describe('SELECT and MULTI_SELECT', () => {
  const definition = { options: [{ id: 'o1', label: 'One' }, { id: 'o2', label: 'Two' }] };

  it('accepts an option id that the definition declares', () => {
    assert.equal(PROPERTY_TYPES.SELECT.check('o1', definition), null);
    assert.equal(PROPERTY_TYPES.MULTI_SELECT.check(['o1', 'o2'], definition), null);
  });

  it('rejects an id the definition does not declare', () => {
    // A value stores the id, never the label — so an unknown id is a value no
    // client could render, and letting it in makes the column lie.
    assert.ok(PROPERTY_TYPES.SELECT.check('o3', definition));
    assert.ok(PROPERTY_TYPES.MULTI_SELECT.check(['o1', 'o3'], definition));
  });

  it('rejects the LABEL, which is the mistake a client actually makes', () => {
    assert.ok(PROPERTY_TYPES.SELECT.check('One', definition));
  });

  it('accepts an empty MULTI_SELECT list — nothing selected is a value', () => {
    assert.equal(PROPERTY_TYPES.MULTI_SELECT.check([], definition), null);
  });

  it('rejects a bare string for MULTI_SELECT and an array for SELECT', () => {
    assert.ok(PROPERTY_TYPES.MULTI_SELECT.check('o1', definition));
    assert.ok(PROPERTY_TYPES.SELECT.check(['o1'], definition));
  });

  it('denies everything when the definition carries no options, rather than throwing', () => {
    // `optionIds` returns [] for a malformed or optionless definition. A throw
    // here would be a 500 on a property somebody deleted the options from.
    assert.ok(PROPERTY_TYPES.SELECT.check('o1', {}));
    assert.ok(PROPERTY_TYPES.SELECT.check('o1', undefined));
    assert.equal(PROPERTY_TYPES.MULTI_SELECT.check([], undefined), null);
  });
});

describe('FILES — the value that becomes a URL the browser fetches', () => {
  it('accepts a list of entries in exactly the shape the upload endpoint returns', () => {
    assert.equal(PROPERTY_TYPES.FILES.check([validFile()]), null);
    assert.equal(PROPERTY_TYPES.FILES.check([]), null);
  });

  it('rejects an entry whose url points anywhere but /uploads/<storedName>', () => {
    // THE check. A free-form url here is a tracking pixel rendered for every
    // member of the workspace, served from a host we do not control.
    assert.ok(PROPERTY_TYPES.FILES.check([validFile({ url: 'https://evil.example/x.png' })]));
    assert.ok(PROPERTY_TYPES.FILES.check([validFile({ url: `/uploads/../${STORED}` })]));
    assert.ok(PROPERTY_TYPES.FILES.check([validFile({ url: '/uploads/other.png' })]));
  });

  it('rejects a storedName that this server could not have generated', () => {
    // `storedName` is what gets joined onto the upload directory. Constraining
    // it to a UUID plus a short extension makes traversal impossible by
    // construction rather than by careful joining.
    const traversal = '../../../etc/passwd';
    assert.ok(
      PROPERTY_TYPES.FILES.check([validFile({ storedName: traversal, url: `/uploads/${traversal}` })])
    );
    assert.ok(PROPERTY_TYPES.FILES.check([validFile({ storedName: 'diagram.png', url: '/uploads/diagram.png' })]));
  });

  it('rejects an entry missing any required field', () => {
    for (const field of ['id', 'name', 'storedName', 'url', 'size', 'mime']) {
      const entry = validFile();
      delete entry[field];
      assert.ok(PROPERTY_TYPES.FILES.check([entry]), `missing ${field} was accepted`);
    }
  });

  it('rejects a non-finite size, which JSON cannot round-trip', () => {
    assert.ok(PROPERTY_TYPES.FILES.check([validFile({ size: NaN })]));
    assert.ok(PROPERTY_TYPES.FILES.check([validFile({ size: '1024' })]));
  });

  it('caps the list at 20 files', () => {
    const twenty = Array.from({ length: 20 }, () => validFile());
    assert.equal(PROPERTY_TYPES.FILES.check(twenty), null);
    assert.ok(PROPERTY_TYPES.FILES.check([...twenty, validFile()]));
  });

  it('rejects a non-array and a list containing null, without throwing', () => {
    assert.ok(PROPERTY_TYPES.FILES.check(validFile()));
    assert.ok(PROPERTY_TYPES.FILES.check([null]));
    assert.ok(PROPERTY_TYPES.FILES.check(['a']));
  });
});

describe('optionIds', () => {
  it('returns the declared ids in order', () => {
    assert.deepEqual(optionIds({ options: [{ id: 'a' }, { id: 'b' }] }), ['a', 'b']);
  });

  it('drops entries with no id rather than returning undefined holes', () => {
    // An `undefined` in the list would make `includes(undefined)` true for a
    // value the client omitted.
    assert.deepEqual(optionIds({ options: [{ id: 'a' }, {}, null] }), ['a']);
  });

  it('returns [] for a definition that has no options at all', () => {
    assert.deepEqual(optionIds(undefined), []);
    assert.deepEqual(optionIds({}), []);
    assert.deepEqual(optionIds({ options: 'nope' }), []);
  });
});

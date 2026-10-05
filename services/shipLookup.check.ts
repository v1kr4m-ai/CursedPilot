// Run: node services/shipLookup.check.ts
import assert from 'node:assert/strict';
import * as w from './shipLookup.ts';
import type { Ship } from '../types.ts';

// shorten: whole sentences, never mid-word, short text untouched
const text = 'INS Kolkata is the lead ship of her class. She was commissioned in 2014 at Mumbai. '.repeat(10);
const s = w.shorten(text, 120);
assert.ok(s.length <= 120 && s.endsWith('.'), s);
assert.equal(w.shorten('Short one.', 120), 'Short one.');
assert.ok(w.shorten('word '.repeat(200), 50).endsWith('…'));
assert.equal(w.shorten('A   spaced\n\ntext.', 100), 'A spaced text.');

// only Indian Navy articles are accepted
assert.ok(w.isIndianNavyArticle({ extract: 'INS Kolkata is a stealth guided-missile destroyer of the Indian Navy.' }));
assert.ok(w.isIndianNavyArticle({ description: 'Indian Navy destroyer', extract: 'x' }));
assert.equal(w.isIndianNavyArticle({ extract: 'HMS Delhi was a Royal Navy light cruiser.' }), false);
assert.equal(w.isIndianNavyArticle({ type: 'disambiguation', extract: 'INS Delhi may refer to Indian Navy ships.' }), false);

// list pages for a name shared by several ships are not accepted
assert.equal(w.isIndianNavyArticle({ extract: 'Two ships operated by the Indian Navy have had the name INS Vikrant. INS Vikrant (1961), a British-built aircraft carrier.' }), false);
assert.equal(w.isIndianNavyArticle({ extract: 'INS Delhi may refer to one of several Indian Navy ships.' }), false);
assert.ok(w.isIndianNavyArticle({ extract: 'INS Vikrant (IAC-1) is an aircraft carrier of the Indian Navy, named after the earlier carrier. Several ships were built by Cochin Shipyard.' }));

// candidate titles: the stored list wins, else a guess from the name
const ship = (name: string, wiki?: string): Ship => ({ id: 'x', name, type: 'Other', particulars: { lengthOverall: 0, breadthOverall: 0, displacement: 0, stemToStandard: 0, stemToBridge: 0, stemToRas: 0, stemToFueling: 0 }, turningDataSets: [], accelDecelData: [], fishtails: [], emLogCalibration: [], compassSwing: [], info: wiki === undefined ? undefined : { shipClass: '', pennant: '', builder: '', commissioned: '', status: '', displacement: '', length: '', beam: '', draught: '', speed: '', propulsion: '', complement: '', armament: '', sensors: '', aircraft: '', notes: '', wiki } });
assert.deepEqual(w.wikiCandidates(ship('INS Kolkata', 'INS_Kolkata_(D63), INS_Kolkata ,Kolkata-class_destroyer')), ['INS_Kolkata_(D63)', 'INS_Kolkata', 'Kolkata-class_destroyer']);
assert.deepEqual(w.wikiCandidates(ship('INS Delhi')), ['INS_Delhi']);
assert.deepEqual(w.wikiCandidates(ship('My Boat', '')), ['INS_My_Boat']);

// staleness
assert.equal(w.isStale(null), true);
assert.equal(w.isStale({ title: 't', extract: 'e', fetchedAt: Date.now() }), false);
assert.equal(w.isStale({ title: 't', extract: 'e', fetchedAt: Date.now() - 40 * 24 * 3600 * 1000 }), true);

console.log('shipLookup: all checks passed');

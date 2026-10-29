// Class specifications for the Bangladesh Navy classes. The small craft are lightly documented in open sources: only what is published is given.
import type { Spec } from '../_util.ts';

const C13B: Spec = { length: '90 m', beam: '11.14 m', draught: '4 m', speed: '25 kn', propulsion: '2 × SEMT Pielstick PA6 STC diesels', complement: '78', armament: '76 mm gun; 2 × 30 mm guns; C-802A anti-ship missiles; HHQ-10 SAM; 2 × 3 torpedo tubes', sensors: 'Type 360 air/surface search radar; Type 347G fire control radar; bow sonar', aircraft: 'Helipad for 1 medium helicopter' };

export const BANGLADESH_SPECS: Record<string, Spec> = {
  t035: { length: '76 m', beam: '7.6 m', draught: '5.1 m', speed: '18 kn (submerged)', propulsion: 'Diesel-electric: Type E390ZC-1 diesel, 3,900 kW', complement: '57', armament: '8 × 533 mm torpedo tubes (6 bow, 2 stern)', sensors: 'Sonar suite (details not published)' },
  ulsan: { length: '~102 m', beam: '~11.5 m', speed: '~34 kn', propulsion: 'CODOG: gas turbines and diesels', armament: 'Guns and anti-ship missiles as fitted for Bangladesh (details not published)' },
  jiangwei: { length: '112 m', beam: '12.4 m', draught: '4.3 m', speed: '28 kn', propulsion: 'CODAD: 2 × 18E390VA diesels (23,600 hp) and 2 × MTU diesels (8,715 hp)', complement: '168', armament: '8 × YJ-83 anti-ship missiles; 8-cell HQ-7 SAM; 1 × H/PJ-33B 100 mm gun; 4 × Type 76A 37 mm guns', sensors: 'Type 360, 517H-1, 345, 352 and 343GA radars; 2 × Type 347G fire control', aircraft: '1 × Harbin Z-9C helicopter' },
  jianghu: { length: '~103 m', beam: '~10.8 m', draught: '~3.1 m', speed: '~26 kn', propulsion: 'Diesels, 2 shafts', complement: '~195', armament: '2 × twin 100 mm guns; 4 × twin 37 mm guns; C-802 / YJ-8 anti-ship missiles; ASW rocket launchers', sensors: 'Type 354 air/surface search; Type 343 fire control radars' },
  hamilton: { length: '115 m', beam: '13 m', draught: '4.6 m', speed: '29 kn', propulsion: 'CODOG: 2 × GE LM2500 gas turbines and 2 × Pielstick diesels', complement: '167 (up to 186)', armament: '1 × 76 mm OTO Melara Mk 75 gun; 25 mm Mk 38 guns; 12.7 mm machine guns', sensors: 'AN/SPS-40E air search; AN/SPS-64 surface search radar', aircraft: 'Flight deck for 1 helicopter' },
  t056: C13B,
  castle: { length: '81 m', beam: '11.5 m', draught: '3.4 m', speed: '19.5 kn', propulsion: '2 × Ruston 12RKC diesels, 2 shafts', complement: '~60', armament: '1 × 76 mm gun; 2 × light guns; machine guns', sensors: 'Type 1006 radars', aircraft: 'Helicopter landing deck' },
  island: { length: '59 m', beam: '11 m', draught: '4.3 m', speed: '16 kn', propulsion: '2 × Ruston-Paxman diesels, 3,270 kW, 1 shaft', complement: '35', armament: '1 × 40 mm Bofors gun (30 mm on some ships)', sensors: 'Kelvin Hughes Type 1006 radar; Simrad RU sidescan sonar' },
  durjoy: { armament: '37 mm or 76 mm gun with 30 mm and 12.7 mm guns (fit varies; details not published)' },
  seadragon: { armament: 'Light guns (40 mm, 30 mm, 12.7 mm)' },
  padma: { armament: 'Light guns (30 mm, 20 mm, 12.7 mm)' },
  meghna: { armament: 'Light guns (30 mm, 12.7 mm)' },
  t021: { length: '38.6 m', beam: '6.8 m', draught: '2.7 m', speed: '35 kn', complement: '28', armament: '4 × C-704 / Silkworm anti-ship missiles; 2 × twin 25 mm guns (some with 4 × AK-230)', sensors: 'Type 352 Square Tie radar; fire control radar on some' },
  chamsuri: { armament: '1 × 40 mm gun; 1 × 20 mm gun; machine guns' },
  river: { armament: 'Light guns; minesweeping gear', sensors: 'Minehunting sonar' },
  t010: { armament: 'Light guns; minesweeping gear' },
  lcu: { armament: 'Unarmed or machine guns' },
  kja: { armament: 'Unarmed or light guns', propulsion: 'Diesel' },
  survey: { armament: 'Unarmed (survey and research equipment)' },
};

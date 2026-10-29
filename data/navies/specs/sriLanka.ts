// Class specifications for the Sri Lanka Navy classes (lightly documented in open sources: only what is published is given).
import type { Spec } from '../_util.ts';

export const SRI_LANKA_SPECS: Record<string, Spec> = {
  hamilton: { length: '115 m', beam: '13 m', draught: '4.6 m', speed: '29 kn', propulsion: 'CODOG: 2 × GE LM2500 gas turbines and 2 × Pielstick diesels', complement: '~170', armament: '1 × 76 mm OTO Melara Mk 75 gun; 25 mm Mk 38 guns; 12.7 mm machine guns', sensors: 'AN/SPS-40E air search; surface search and navigation radars', aircraft: 'Flight deck for 1 helicopter' },
  saryu: { length: '105 m', beam: '12.9 m', draught: '3.6 m', speed: '25 kn', propulsion: '2 × diesel engines, 2 shafts', complement: '~125', armament: '1 × 76 mm OTO Melara gun; 2 × 30 mm AK-630M guns; 12.7 mm machine guns', sensors: 'Surface search and navigation radars', aircraft: 'Flight deck and hangar for 1 helicopter' },
  opv: { armament: 'Light guns (30 mm, 20 mm, 12.7 mm; fit varies)' },
  saar4: { length: '58 m', beam: '7.6 m', draught: '2.4 m', speed: '32 kn', propulsion: '4 × MTU diesels', complement: '~45', armament: '76 mm OTO Melara gun; 20 mm guns; Gabriel anti-ship missiles (as built)' },
  yuhai: { armament: 'Light guns (25 mm and 12.7 mm)' },
};

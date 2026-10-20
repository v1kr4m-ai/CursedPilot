// The look of a field: a box with the label inside it, small, above the value, so a field is about 40 px tall.
export const BOX = 'block rounded-xl border bg-white px-3 pt-1 pb-1 focus-within:border-blue-400 transition-colors';
export const BOX_LABEL = 'block text-[9px] leading-tight font-bold text-slate-400 uppercase tracking-wider';
export const BOX_INPUT = 'w-full bg-transparent p-0 text-sm leading-6 font-bold text-slate-900 outline-none placeholder:text-slate-300';
export const boxTone = (invalid?: boolean, fromShip?: boolean) => (invalid ? 'border-red-400' : fromShip ? 'border-emerald-300' : 'border-slate-200');

// Physical "snail" (spiral serpentine) chains — each is one continuous run of seats
// spanning several tables. Used ONLY for push-left / push-right so a push flows along
// the whole snail. Derived from seat geometry; does NOT affect seat codes or assignments.
// Sizes: two 49-seat snails (top) + two 42-seat snails (bottom) = 182 serpentine seats.
export const SNAIL_CHAINS: string[][] = [
  ["S197","S196","S195","S194","S193","S192","S191","S190","S189","S188","S187","S186","S185","S184","S183","S182","S181","S180","S179","S178","S177","S176","S175","S174","S173","S172","S171","S170","S169","S168","S167","S166","S165","S164","S163","S162","S161","S160","S159","S158","S157","S156"],
  ["S131","S130","S129","S128","S127","S126","S125","S124","S123","S122","S121","S120","S119","S118","S117","S116","S115","S114","S113","S112","S111","S110","S109","S108","S107","S106","S105","S104","S103","S102","S101","S100","S099","S098","S097","S096","S095","S094","S093","S092","S091","S090"],
  ["S088","S087","S086","S085","S084","S083","S082","S081","S080","S079","S078","S077","S076","S075","S074","S073","S072","S071","S070","S069","S068","S067","S066","S065","S064","S063","S062","S061","S060","S059","S058","S057","S056","S055","S054","S053","S052","S051","S050","S049","S048","S047","S046","S045","S044","S043","S042","S041","S089"],
  ["S154","S153","S152","S242","S241","S240","S239","S238","S237","S236","S235","S234","S233","S232","S231","S230","S229","S228","S227","S226","S225","S224","S223","S222","S221","S220","S219","S218","S217","S216","S215","S214","S213","S212","S211","S210","S209","S208","S207","S206","S205","S204","S203","S202","S201","S200","S199","S198","S155"],
];
// code -> the ordered snail chain it belongs to (for push traversal).
export const SNAIL_OF_CODE: Record<string, string[]> = {};
for (const chain of SNAIL_CHAINS) for (const c of chain) SNAIL_OF_CODE[c] = chain;

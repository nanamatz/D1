import type { FableId } from '../engine/fables';

import fable1 from '../../docs/Arts/Cards/Fable/T_Fable1.png';
import fable2 from '../../docs/Arts/Cards/Fable/T_Fable2.png';
import fable3 from '../../docs/Arts/Cards/Fable/T_Fable3.png';
import fable4 from '../../docs/Arts/Cards/Fable/T_Fable4.png';
import fable5 from '../../docs/Arts/Cards/Fable/T_Fable5.png';
import fable6 from '../../docs/Arts/Cards/Fable/T_Fable6.png';
import fable7 from '../../docs/Arts/Cards/Fable/T_Fable7.png';
import fable8 from '../../docs/Arts/Cards/Fable/T_Fable8.png';
import fable9 from '../../docs/Arts/Cards/Fable/T_Fable9.png';
import fable10 from '../../docs/Arts/Cards/Fable/T_Fable10.png';
import fable11 from '../../docs/Arts/Cards/Fable/T_Fable11.png';
import fable12 from '../../docs/Arts/Cards/Fable/T_Fable12.png';
import fable13 from '../../docs/Arts/Cards/Fable/T_Fable13.png';
import fable14 from '../../docs/Arts/Cards/Fable/T_Fable14.png';
import fable15 from '../../docs/Arts/Cards/Fable/T_Fable15.png';
import fable16 from '../../docs/Arts/Cards/Fable/T_Fable16.png';
import fable17 from '../../docs/Arts/Cards/Fable/T_Fable17.png';
import fable18 from '../../docs/Arts/Cards/Fable/T_Fable18.png';

export const FABLE_ART: Readonly<Record<FableId, string>> = {
  fable1, fable2, fable3, fable4, fable5, fable6,
  fable7, fable8, fable9, fable10, fable11, fable12,
  fable13, fable14, fable15, fable16, fable17, fable18,
};

export const fableArt = (id: FableId): string => FABLE_ART[id];

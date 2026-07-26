import type { FableId } from '../engine/fables';

import fable1 from '../../docs/Arts/Cards/Fable/Vector/T_Fable1.svg';
import fable2 from '../../docs/Arts/Cards/Fable/Vector/T_Fable2.svg';
import fable3 from '../../docs/Arts/Cards/Fable/Vector/T_Fable3.svg';
import fable4 from '../../docs/Arts/Cards/Fable/Vector/T_Fable4.svg';
import fable5 from '../../docs/Arts/Cards/Fable/Vector/T_Fable5.svg';
import fable6 from '../../docs/Arts/Cards/Fable/Vector/T_Fable6.svg';
import fable7 from '../../docs/Arts/Cards/Fable/Vector/T_Fable7.svg';
import fable8 from '../../docs/Arts/Cards/Fable/Vector/T_Fable8.svg';
import fable9 from '../../docs/Arts/Cards/Fable/Vector/T_Fable9.svg';
import fable10 from '../../docs/Arts/Cards/Fable/Vector/T_Fable10.svg';
import fable11 from '../../docs/Arts/Cards/Fable/Vector/T_Fable11.svg';
import fable12 from '../../docs/Arts/Cards/Fable/Vector/T_Fable12.svg';
import fable13 from '../../docs/Arts/Cards/Fable/Vector/T_Fable13.svg';
import fable14 from '../../docs/Arts/Cards/Fable/Vector/T_Fable14.svg';
import fable15 from '../../docs/Arts/Cards/Fable/Vector/T_Fable15.svg';
import fable16 from '../../docs/Arts/Cards/Fable/Vector/T_Fable16.svg';
import fable17 from '../../docs/Arts/Cards/Fable/Vector/T_Fable17.svg';
import fable18 from '../../docs/Arts/Cards/Fable/Vector/T_Fable18.svg';

export const FABLE_ART: Readonly<Record<FableId, string>> = {
  fable1, fable2, fable3, fable4, fable5, fable6,
  fable7, fable8, fable9, fable10, fable11, fable12,
  fable13, fable14, fable15, fable16, fable17, fable18,
};

export const fableArt = (id: FableId): string => FABLE_ART[id];

import type { FableId } from '../engine/fables';

import fable1 from '../../docs/Arts/Cards/Fable/Vector/T_Fable1-preview.png';
import fable2 from '../../docs/Arts/Cards/Fable/Vector/T_Fable2-preview.png';
import fable3 from '../../docs/Arts/Cards/Fable/Vector/T_Fable3-preview.png';
import fable4 from '../../docs/Arts/Cards/Fable/Vector/T_Fable4-preview.png';
import fable5 from '../../docs/Arts/Cards/Fable/Vector/T_Fable5-preview.png';
import fable6 from '../../docs/Arts/Cards/Fable/Vector/T_Fable6-preview.png';
import fable7 from '../../docs/Arts/Cards/Fable/Vector/T_Fable7-preview.png';
import fable8 from '../../docs/Arts/Cards/Fable/Vector/T_Fable8-preview.png';
import fable9 from '../../docs/Arts/Cards/Fable/Vector/T_Fable9-preview.png';
import fable10 from '../../docs/Arts/Cards/Fable/Vector/T_Fable10-preview.png';
import fable11 from '../../docs/Arts/Cards/Fable/Vector/T_Fable11-preview.png';
import fable12 from '../../docs/Arts/Cards/Fable/Vector/T_Fable12-preview.png';
import fable13 from '../../docs/Arts/Cards/Fable/Vector/T_Fable13-preview.png';
import fable14 from '../../docs/Arts/Cards/Fable/Vector/T_Fable14-preview.png';
import fable15 from '../../docs/Arts/Cards/Fable/Vector/T_Fable15-preview.png';
import fable16 from '../../docs/Arts/Cards/Fable/Vector/T_Fable16-preview.png';
import fable17 from '../../docs/Arts/Cards/Fable/Vector/T_Fable17-preview.png';
import fable18 from '../../docs/Arts/Cards/Fable/Vector/T_Fable18-preview.png';
import fable19 from '../../docs/Arts/Cards/Fable/Vector/T_Fable19-preview.png';
import fable20 from '../../docs/Arts/Cards/Fable/Vector/T_Fable20-preview.png';

export const FABLE_ART: Readonly<Record<FableId, string>> = {
  fable1, fable2, fable3, fable4, fable5, fable6,
  fable7, fable8, fable9, fable10, fable11, fable12,
  fable13, fable14, fable15, fable16, fable17, fable18, fable19, fable20,
};

export const fableArt = (id: FableId): string => FABLE_ART[id];

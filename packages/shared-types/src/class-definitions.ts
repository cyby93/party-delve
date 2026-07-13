import { PlayerClass } from './player.js';

export type AbilityInputType = 'AUTO' | 'RELEASE' | 'TAP' | 'AIM_CAST';

export interface ClassAbilityDef {
  name: string;
  inputType: AbilityInputType;
}

export interface ClassDef {
  id: PlayerClass;
  displayName: string;
  role: string;
  flavor: string;
  abilities: [ClassAbilityDef, ClassAbilityDef, ClassAbilityDef, ClassAbilityDef];
}

export const CLASS_DEFINITIONS: Record<PlayerClass, ClassDef> = {
  [PlayerClass.STONEHIDE]: {
    id: PlayerClass.STONEHIDE,
    displayName: 'Stonehide',
    role: 'Tank · Frontline Anchor',
    flavor: 'Called from the mountain clans, where endurance is prayer.',
    abilities: [
      { name: 'Stone Wall',    inputType: 'RELEASE' },
      { name: 'Tremor Stomp', inputType: 'TAP'      },
      { name: 'Iron Skin',    inputType: 'TAP'      },
      { name: 'Avalanche',    inputType: 'AUTO'     },
    ],
  },
  [PlayerClass.SPIRITCALLER]: {
    id: PlayerClass.SPIRITCALLER,
    displayName: 'Spiritcaller',
    role: 'Burst Healer · Revive Support',
    flavor: 'Calls on the dead to protect the living. Timing is everything.',
    abilities: [
      { name: "Ancestor's Voice", inputType: 'AUTO'    },
      { name: 'Spirit Nova',      inputType: 'TAP'     },
      { name: 'Soul Mend',        inputType: 'AIM_CAST' },
      { name: 'Warding Cry',      inputType: 'TAP'     },
    ],
  },
  [PlayerClass.SOULDRINKER]: {
    id: PlayerClass.SOULDRINKER,
    displayName: 'Souldrinker',
    role: 'Drain DPS · Risk-Reward',
    flavor: 'The Bloodrite trade in sacrifice and return. Pain is currency.',
    abilities: [
      { name: 'Blood Draw',   inputType: 'AUTO'    },
      { name: 'Crimson Lash', inputType: 'RELEASE' },
      { name: 'Dark Pact',    inputType: 'RELEASE' },
      { name: 'Void Pulse',   inputType: 'RELEASE' },
    ],
  },
  [PlayerClass.STORMCALLER]: {
    id: PlayerClass.STORMCALLER,
    displayName: 'Stormcaller',
    role: 'Zone DPS · Area Pressure',
    flavor: 'Where the shaman walks, the sky cracks open.',
    abilities: [
      { name: 'Lightning Arc', inputType: 'AUTO'    },
      { name: 'Tempest Hurl',  inputType: 'RELEASE' },
      { name: 'Thunder Clap',  inputType: 'TAP'     },
      { name: 'Storm Eye',     inputType: 'RELEASE' },
    ],
  },
};

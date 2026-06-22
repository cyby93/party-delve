import type { BondState, SessionColor } from 'shared-types';

export interface CooldownUpdateMsg {
  type: 'cooldown:update';
  abilityIndex: number;
  remainingMs: number;
}

export interface BondNotificationMsg {
  type: 'bond:notification';
  bond: BondState;
}

export interface SpiritFormMsg {
  type: 'spirit:form';
  isActive: boolean;
}

export interface ReconnectMsg {
  type: 'reconnect';
  playerId: string;
  sessionColor: SessionColor;
}

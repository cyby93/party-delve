import type { BondType, SessionColor } from 'shared-types';

export interface CooldownUpdateMsg {
  type: 'cooldown:update';
  abilityIndex: number;
  /** Server epoch (ms, `Date.now()`) at which the cooldown began. */
  startedAtMs: number;
  /** Server epoch (ms) at which the cooldown ends. `expiresAtMs <= serverNowMs`
   *  means "cleared / ready now" (the client sets the slot to null). */
  expiresAtMs: number;
  /** Server clock (`Date.now()`) at send time. The controller runs on a separate
   *  device from the sim in Local Party Mode, so the two wall clocks can differ;
   *  the client corrects for that skew via `skew = clientNow - serverNowMs` and
   *  applies it to `startedAtMs`/`expiresAtMs`. Replaces the former duration-based
   *  `remainingMs`, which was clock-skew-immune but latency-/reconnect-naive
   *  (the cooldown arc mis-rendered after a reconnect). See ADR-0004. */
  serverNowMs: number;
}

export interface BondNotificationMsg {
  type: 'bond:notification';
  playerA: string;
  playerB: string;
  bondType: BondType;
  bondColor: string;
  bondDescription: string;
  bondMechanic: string;
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

export interface RunVictoryMsg {
  type: 'run:victory';
  essenceEarned: number;
}

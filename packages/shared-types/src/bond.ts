export enum BondType {
  SHIELD_LINK = 'shield_link',
  SPIRIT_BRIDGE = 'spirit_bridge',
  ESSENCE_FLOW = 'essence_flow',
  WAR_PACT = 'war_pact',
}

export interface BondState {
  id: string;
  type: BondType;
  playerAId: string;
  playerBId: string;
  buff: string;
  price: string;
  isActive: boolean;
}

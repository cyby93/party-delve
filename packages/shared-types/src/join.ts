/** Sent by the host client as the payload of a JOIN message envelope. */
export interface HostJoinRequest {
  role: 'host';
}

/** Sent by a mobile controller as the payload of a JOIN message envelope. */
export interface PlayerJoinRequest {
  role: 'player';
  /** The 4-character room code displayed on the host screen. */
  roomCode: string;
}

/** Discriminated union of all valid join request payloads. */
export type JoinRequest = HostJoinRequest | PlayerJoinRequest;

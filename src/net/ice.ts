/**
 * How the two players find a path to each other (WebRTC ICE servers).
 *
 * STUN servers let each browser learn its public address, so most home
 * networks connect directly. When that is impossible (mobile data, strict
 * routers), the connection has to go through a TURN relay. The relay PeerJS
 * used to bundle no longer exists, so ours is listed here.
 */

const STUN: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

/** relay servers (filled in once a free TURN account exists) */
const TURN: RTCIceServer[] = [];

export const ICE_CONFIG: RTCConfiguration = {
  iceServers: [...STUN, ...TURN],
};

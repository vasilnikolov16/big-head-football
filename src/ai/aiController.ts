import { BALL_GRAVITY, DT, GOAL_DEPTH, GROUND_Y, PLAYER_GRAVITY, W } from '../core/constants';
import { clamp, rand, sign } from '../core/math';
import type { Controller, PlayerIntent } from '../input/controls';
import { Ball, makeImpactLog, stepBall } from '../physics/ball';
import type { Match } from '../game/match';
import type { Player } from '../game/player';

export type Difficulty = 'easy' | 'medium' | 'hard';

interface Profile {
  /** seconds between decisions (reaction time) */
  think: number;
  /** how far ahead the ball flight is predicted */
  lookahead: number;
  /** random error added to the target position, px */
  aimNoise: number;
  /** fraction of top speed used */
  speed: number;
  /** chance to go for a header when one is possible */
  headerChance: number;
  /** allowed jump timing error, s */
  jumpTolerance: number;
  /** chance per decision to "daydream" and keep the old plan */
  daydream: number;
  /** evaluate kicks every physics step with prediction (precise) or only when thinking */
  preciseKick: boolean;
  /** chance to take a kick when the ball is in range */
  kickChance: number;
  /** chance to hop over a ball that is behind it instead of shoving it into its own goal */
  jumpOver: number;
  /** chance per decision to arm the super shot when it is ready and the ball is close */
  superUse: number;
  /** chance per decision to dash when it has to cover a long way quickly */
  dash: number;
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    think: 0.32,
    lookahead: 0.45,
    aimNoise: 60,
    speed: 0.68,
    headerChance: 0.3,
    jumpTolerance: 0.12,
    daydream: 0.15,
    preciseKick: false,
    kickChance: 0.4,
    jumpOver: 0.2,
    superUse: 0.25,
    dash: 0.06,
  },
  medium: {
    think: 0.15,
    lookahead: 0.9,
    aimNoise: 22,
    speed: 0.88,
    headerChance: 0.65,
    jumpTolerance: 0.06,
    daydream: 0.04,
    preciseKick: true,
    kickChance: 0.7,
    jumpOver: 0.6,
    superUse: 0.6,
    dash: 0.2,
  },
  hard: {
    think: 0.06,
    lookahead: 1.4,
    aimNoise: 4,
    speed: 1,
    headerChance: 0.95,
    jumpTolerance: 0.035,
    daydream: 0,
    preciseKick: true,
    kickChance: 1,
    jumpOver: 1,
    superUse: 1,
    dash: 0.35,
  },
};

interface PathPoint {
  x: number;
  y: number;
  t: number;
}

const PRED_DT = 1 / 60;
const KICK_LEAD = 0.055; // time from key press to the sweet spot of the swing

export type AIMode = 'attack' | 'defend' | 'recover';

/**
 * Computer opponent. It predicts the ball flight with the real physics code,
 * picks the earliest point where it can meet the ball, stays goal-side of it,
 * times headers with its own jump arc and kicks when the ball will meet the foot.
 * Lower difficulties think slower, aim worse, run slower and miss chances.
 */
export class AIController implements Controller {
  private p: Profile;
  private thinkT = 0;
  private targetX = W / 2;
  private wantJump = false;
  private jumpHoldT = 0;
  private kickCd = 0;
  private wantKick = false;
  private allowKick = true;
  private wantSuper = false;
  private wantDash = 0;
  private sim = new Ball();
  private impacts = makeImpactLog();
  private path: PathPoint[] = [];
  mode: AIMode = 'attack';

  constructor(
    private match: Match,
    private index: 0 | 1,
    public difficulty: Difficulty,
  ) {
    this.p = PROFILES[difficulty];
    const maxPts = Math.ceil(1.5 / PRED_DT) + 2;
    for (let i = 0; i < maxPts; i++) this.path.push({ x: 0, y: 0, t: 0 });
  }

  private get me(): Player {
    return this.match.players[this.index];
  }

  read(out: PlayerIntent): void {
    const me = this.me;
    this.thinkT -= DT;
    this.kickCd -= DT;
    if (this.thinkT <= 0) {
      this.thinkT = this.p.think * rand(0.7, 1.3);
      if (Math.random() >= this.p.daydream) this.think();
    }

    // steer towards the target
    const dx = this.targetX - me.x;
    let move = 0;
    if (Math.abs(dx) > 6) move = sign(dx) * (Math.abs(dx) < 36 ? 0.45 : 1) * this.p.speed;
    out.move = move;

    out.jumpPressed = this.wantJump;
    if (this.wantJump) {
      this.wantJump = false;
      this.jumpHoldT = 0.32;
    }
    out.jumpHeld = this.jumpHoldT > 0;
    this.jumpHoldT -= DT;

    let kick = false;
    if (this.p.preciseKick) kick = this.kickCheck();
    else if (this.wantKick) {
      kick = true;
      this.wantKick = false;
    }
    out.kickPressed = kick && this.kickCd <= 0 && !me.kicking;
    if (out.kickPressed) this.kickCd = 0.25;
    out.superPressed = this.wantSuper && me.energy >= 1 && !me.charged;
    if (out.superPressed) this.wantSuper = false;
    out.dash = this.wantDash;
    this.wantDash = 0;
  }

  // ------------------------------------------------------------ prediction

  /** Fills `path` with the predicted ball flight; returns the number of points. */
  private predict(seconds: number): number {
    const b = this.match.ball;
    const s = this.sim;
    s.x = b.x;
    s.y = b.y;
    s.vx = b.vx;
    s.vy = b.vy;
    s.spin = b.spin;
    s.r = b.r;
    s.gravityScale = b.gravityScale;
    if (this.match.phase === 'kickoff') s.vx = s.vy = 0; // hovering ball: it will drop
    const n = Math.min(this.path.length, Math.ceil(seconds / PRED_DT));
    for (let i = 0; i < n; i++) {
      const pt = this.path[i];
      pt.x = s.x;
      pt.y = s.y;
      pt.t = i * PRED_DT;
      stepBall(s, this.match.arena, PRED_DT, this.impacts);
    }
    return n;
  }

  // ------------------------------------------------------------ decisions

  private think(): void {
    const me = this.me;
    const b = this.match.ball;
    const f = me.facing;
    const ownWall = f === 1 ? 0 : W;
    const u = (x: number): number => (x - ownWall) * f; // distance from my own wall
    const n = this.predict(this.p.lookahead);
    const path = this.path;
    const goalTop = this.match.arena.goalTop[this.index];
    const reachY = GROUND_Y - me.height - 150; // highest point a header can reach
    const offset = b.r + 24; // stand this far goal-side of the ball

    this.allowKick = Math.random() < this.p.kickChance;

    // 1) Is the ball about to enter my goal?
    let threat: PathPoint | null = null;
    for (let i = 0; i < n; i++) {
      const pt = path[i];
      if (u(pt.x) < GOAL_DEPTH + 30 && pt.y > goalTop - 20) {
        threat = pt;
        break;
      }
    }

    // 2) The earliest playable point of the flight that I can reach in time.
    let intercept: PathPoint | null = null;
    for (let i = 0; i < n; i++) {
      const pt = path[i];
      if (pt.y < reachY) continue;
      const need = Math.abs(pt.x - f * offset - me.x) / (me.maxSpeed * this.p.speed);
      if (need <= pt.t + 0.04) {
        intercept = pt;
        break;
      }
    }
    const aim = intercept ?? path[Math.max(0, n - 1)];

    if (u(b.x) < u(me.x) - 12) {
      // The ball got past me: get goal-side again.
      this.mode = 'recover';
      const x = f === 1 ? Math.min(aim.x, b.x) : Math.max(aim.x, b.x);
      this.targetX = x - f * (offset + 18);
      // hop over a low ball instead of shoving it into my own goal
      if (Math.abs(b.x - me.x) < 115 && b.y > GROUND_Y - 95 && me.grounded && Math.random() < this.p.jumpOver) {
        this.wantJump = true;
      }
    } else if (threat) {
      // Shot on my goal: meet the ball as early as possible, otherwise guard the line.
      this.mode = 'defend';
      if (intercept && intercept.t <= threat.t) this.targetX = intercept.x - f * offset * 0.6;
      else this.targetX = ownWall + f * (GOAL_DEPTH + 8);
    } else {
      // Attack: a high ball -> get under it for a header; otherwise line up the foot.
      this.mode = 'attack';
      const aerial = aim.y < me.headY - me.headR - 40;
      this.targetX = aim.x - f * (aerial ? 12 : offset);
    }

    // Ball bouncing on my head: step back so it drops in front of the foot (no juggling).
    const onHead =
      Math.abs(b.x - me.headX) < me.headR * 1.1 && b.y < me.headY - me.headR * 0.4 && b.y > me.headY - me.headR - 150;
    if (onHead && me.grounded && this.mode !== 'recover') this.targetX = b.x - f * (offset + 6);

    this.targetX = clamp(this.targetX + rand(-1, 1) * this.p.aimNoise, me.halfW, W - me.halfW);

    this.considerHeader(n);
    this.considerDash();

    // Arm the super when the ball is about to be played (in front of me and close).
    if (me.energy >= 1 && !me.charged) {
      const rx = (b.x - me.x) * f;
      const close = rx > -10 && rx < 170 && Math.abs(b.y - me.headY) < 260;
      if (close && Math.random() < this.p.superUse) this.wantSuper = true;
    }

    // coarse kicking for the easy AI
    if (!this.p.preciseKick) {
      const rx = (b.x - me.x) * f;
      if (rx > 5 && rx < 80 && b.y > GROUND_Y - 110 && this.allowKick) this.wantKick = true;
    }
  }

  /** Dash when the ball got past me or a long way has to be covered quickly. */
  private considerDash(): void {
    const me = this.me;
    if (me.dashCd > 0 || !me.grounded || this.match.phase !== 'playing') return;
    const dx = this.targetX - me.x;
    const far = Math.abs(dx) > (this.mode === 'attack' ? 300 : 200);
    if (!far || Math.sign(me.vx) !== Math.sign(dx)) return;
    const urgent = this.mode === 'recover' || this.mode === 'defend';
    if (Math.random() < this.p.dash * (urgent ? 1.6 : 0.6)) this.wantDash = Math.sign(dx);
  }

  /** Time to raise the head by `h` px with a full jump (null if out of reach). */
  private riseTime(h: number): number | null {
    const v0 = this.me.jumpV;
    const g = PLAYER_GRAVITY;
    const disc = v0 * v0 - 2 * g * h;
    if (disc < 0) return null;
    return (v0 - Math.sqrt(disc)) / g;
  }

  /** Jump now if the head will meet the ball at the top of the ball's path through my column. */
  private considerHeader(n: number): void {
    const me = this.me;
    if (!me.grounded || this.wantJump) return;
    const hx = me.headX + me.facing * 8; // meet it slightly in front -> header goes forward
    for (let i = 1; i < n; i++) {
      const pt = this.path[i];
      if (Math.abs(pt.x - hx) > me.headR * 0.9) continue;
      const h = me.headY - pt.y - me.headR * 0.4;
      if (h < 25) return; // reachable without a jump
      const tr = this.riseTime(h);
      if (tr === null) return;
      if (Math.abs(tr - pt.t) <= this.p.jumpTolerance && Math.random() < this.p.headerChance) this.wantJump = true;
      return;
    }
  }

  /** Precise kick: will the ball be at my foot's sweet spot when the swing gets there? */
  private kickCheck(): boolean {
    const me = this.me;
    const b = this.match.ball;
    if (!this.allowKick || (this.match.phase !== 'playing' && this.match.phase !== 'goal')) return false;
    const lead = KICK_LEAD + (this.difficulty === 'medium' ? rand(-0.02, 0.025) : 0);
    const bx = b.x + b.vx * lead;
    const by = b.y + b.vy * lead + 0.5 * BALL_GRAVITY * lead * lead;
    const dx = bx - (me.hipX + me.facing * 19 + me.vx * lead);
    const dy = by - (me.hipY + 8);
    const reach = b.r + me.footR + 9;
    if (dx * dx + dy * dy > reach * reach) return false;
    return (bx - me.x) * me.facing >= 0;
  }
}

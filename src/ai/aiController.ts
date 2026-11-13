import { BALL_GRAVITY, DT, GOAL_DEPTH, GROUND_Y, PLAYER_GRAVITY, W } from '../core/constants';
import { clamp, rand, sign } from '../core/math';
import type { Controller, PlayerIntent } from '../input/controls';
import { Ball, makeImpactLog, stepBall } from '../physics/ball';
import type { Match } from '../game/match';
import { KICK_FWD, type Player } from '../game/player';
import { inKickZone } from '../game/interactions';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

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
  /** average seconds between deliberate kicks at the other player when they are right in front (0 = never) */
  bullyEvery: number;
  /** chance to run back and guard the goal while the opponent winds up a super shot */
  windupGuard: number;
  /** picks the kick timing (drive / power / lob) by simulating where each shot would go */
  shotPick: boolean;
  /** saves the super for a moment when the opponent is out of position */
  superSmart: boolean;
  /** reads an incoming super shot: keeps to the goal line and jumps into its path */
  superDefend: boolean;
}

export const PROFILES: Record<Difficulty, Profile> = {
  easy: {
    think: 0.32,
    lookahead: 0.7,
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
    bullyEvery: 0,
    windupGuard: 0.25,
    shotPick: false,
    superSmart: false,
    superDefend: false,
  },
  medium: {
    think: 0.15,
    lookahead: 1.3,
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
    bullyEvery: 14,
    windupGuard: 0.65,
    shotPick: false,
    superSmart: false,
    superDefend: false,
  },
  hard: {
    think: 0.06,
    lookahead: 1.9,
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
    bullyEvery: 7,
    windupGuard: 1,
    shotPick: false,
    superSmart: false,
    superDefend: false,
  },
  expert: {
    think: 0.035,
    lookahead: 2.1,
    aimNoise: 0,
    speed: 1,
    headerChance: 1,
    jumpTolerance: 0.025,
    daydream: 0,
    preciseKick: true,
    kickChance: 1,
    jumpOver: 1,
    superUse: 1,
    dash: 0.55,
    bullyEvery: 4,
    windupGuard: 1,
    shotPick: true,
    superSmart: true,
    superDefend: true,
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
  /** this attack: let the ball drop to the foot (kick / volley) rather than head it */
  private footPlay = false;
  private footRoll = 0;
  /** seconds until the next deliberate kick at the other player is allowed */
  private bullyCd = 0;
  /** seconds the expert has been saving a full super bar */
  private superWait = 0;
  /** expert shot picking: cached scores of the kick timings */
  private shotCacheAt = -9;
  private shotBest = 0.42;
  private shotScores: number[] = [];
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
    const maxPts = Math.ceil(2 / PRED_DT) + 2;
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
    this.bullyCd -= DT;
    if (!kick && this.p.bullyEvery > 0 && this.bullyCd <= 0 && this.kickCd <= 0 && !me.kicking && this.canBully()) {
      kick = true;
      this.bullyCd = this.p.bullyEvery * rand(0.6, 1.4);
    }
    out.kickPressed = kick && this.kickCd <= 0 && !me.kicking;
    if (out.kickPressed) this.kickCd = 0.25;
    out.superPressed = this.wantSuper && me.energy >= 1 && !me.charged;
    if (out.superPressed) {
      this.wantSuper = false;
      this.superWait = 0;
    }
    out.dash = this.wantDash;
    this.wantDash = 0;
  }

  // ------------------------------------------------------------ prediction

  /** Fills `path` with the predicted ball flight; returns the number of points. */
  /** the ball this AI cares about (with two balls: the more dangerous one) */
  private target: Ball | null = null;

  private get ball(): Ball {
    return this.target ?? this.match.ball;
  }

  private pickBall(): void {
    const m = this.match;
    if (m.extraBalls.length === 0) {
      this.target = null;
      return;
    }
    const me = this.me;
    const f = me.facing;
    const ownWall = f === 1 ? 0 : W;
    let best = m.ball;
    let bestScore = Infinity;
    for (const b of [m.ball, ...m.extraBalls]) {
      // close to my goal and heading there = urgent; otherwise the nearest one
      const fromGoal = (b.x - ownWall) * f;
      const coming = b.vx * f < -100 ? -250 : 0;
      const score = fromGoal < W / 2 ? fromGoal + coming : W + Math.abs(b.x - me.x);
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    this.target = best;
  }

  private predict(seconds: number): number {
    const b = this.ball;
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
    const sup = this.match.superShot;
    if (sup?.holding) {
      // the opponent winds up a super shot: get into its path (in front of my goal)
      if (sup.owner !== this.index && Math.random() < this.p.windupGuard) this.guardSuper();
      this.wantJump = false;
      this.wantDash = 0;
      return;
    }
    if (sup && !sup.done && sup.owner !== this.index && this.p.superDefend) {
      this.defendSuper();
      return;
    }
    this.pickBall();
    const me = this.me;
    const b = this.ball;
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
    let aim = intercept ?? path[Math.max(0, n - 1)];

    // Re-decide now and then whether to head the ball or let it drop to the foot.
    this.footRoll -= this.p.think;
    if (this.footRoll <= 0) {
      this.footRoll = rand(0.9, 1.6);
      this.footPlay = Math.random() > this.p.headerChance * 0.55;
    }
    // where the floating ball comes down to kicking height, if I can get there in time
    if (this.footPlay && intercept && intercept.y < GROUND_Y - 110) {
      for (let i = 0; i < n; i++) {
        const pt = path[i];
        if (pt.y < GROUND_Y - 95 || pt.t < intercept.t) continue;
        const need = Math.abs(pt.x - f * offset - me.x) / (me.maxSpeed * this.p.speed);
        if (need <= pt.t + 0.04 && u(pt.x) > u(me.x) - 40) aim = pt;
        break;
      }
    }

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
      if (close && Math.random() < this.p.superUse && (!this.p.superSmart || this.goodSuperMoment())) this.wantSuper = true;
    }

    // coarse kicking for the easy AI
    if (!this.p.preciseKick) {
      const rx = (b.x - me.x) * f;
      if (((rx > 5 && rx < 80 && b.y > GROUND_Y - 110) || inKickZone(b, me)) && this.allowKick) this.wantKick = true;
    }
  }

  /** During the opponent's wind-up: stand on my goal line, between the ball and the goal. */
  private guardSuper(): void {
    const me = this.me;
    const f = me.facing;
    const ownWall = f === 1 ? 0 : W;
    const b = this.match.ball;
    const line = ownWall + f * (GOAL_DEPTH + me.halfW + 6);
    // shot from right in front of the goal: stand a little out, not inside the aura
    const fromBall = (b.x - line) * f;
    this.targetX = fromBall < 130 ? line : line + f * Math.min(60, (fromBall - 130) * 0.25);
    this.targetX = clamp(this.targetX + rand(-1, 1) * this.p.aimNoise * 0.5, me.halfW, W - me.halfW);
    this.mode = 'defend';
  }

  /** Expert: an incoming super flies its own way (homing, zigzag...): mind the goal and jump into it. */
  private defendSuper(): void {
    const me = this.me;
    const b = this.match.ball;
    const f = me.facing;
    const ownWall = f === 1 ? 0 : W;
    const line = ownWall + f * (GOAL_DEPTH + me.halfW + 6);
    const ahead = (b.x - me.x) * f; // > 0: still in front of me
    const coming = b.vx * f < -50;
    // close and coming: step into it; otherwise hold the line
    if (ahead > 0 && ahead < 260 && coming) this.targetX = me.x + f * Math.min(40, ahead * 0.3);
    else this.targetX = (line - me.x) * f > 0 || Math.abs(line - me.x) < 140 ? line : me.x + (line - me.x) * 0.6;
    this.targetX = clamp(this.targetX, me.halfW, W - me.halfW);
    this.mode = 'defend';
    // a high ball about to fly over my head: jump into it
    if (me.grounded && coming && ahead > 0 && ahead < 150 + Math.abs(b.vx) * 0.12 && b.y < me.headY - me.headR * 0.5 && b.y > me.headY - me.headR - 190) this.wantJump = true;
  }

  /** The other player is fighting for the ball right in front of me: give them a kick. */
  private canBully(): boolean {
    const me = this.me;
    const opp = this.match.players[1 - this.index];
    if (this.match.phase !== 'playing' || this.match.superShot || opp.kickImmuneT > 0 || opp.stunT > 0) return false;
    const ahead = (opp.x - me.x) * me.facing;
    if (ahead <= 0 || ahead > me.headR + opp.headR + 20 || Math.abs(opp.y - me.y) > 50) return false;
    // the other player stands between me and the ball: kick them out of the way
    const b = this.ball;
    const ballAhead = (b.x - me.x) * me.facing;
    return ballAhead > ahead && ballAhead < ahead + 220 && b.y > GROUND_Y - 220;
  }

  /**
   * Expert: fire the super when the opponent can't get back in time (far from
   * their goal, dazed or in the air), or when it has waited long enough.
   */
  private goodSuperMoment(): boolean {
    const me = this.me;
    const opp = this.match.players[1 - this.index];
    this.superWait += this.p.think;
    if (this.superWait > 9) return true;
    const oppWall = me.facing === 1 ? W : 0;
    const oppFromGoal = Math.abs(opp.x - oppWall) - GOAL_DEPTH;
    const myFromGoal = Math.abs(this.ball.x - oppWall) - GOAL_DEPTH;
    if (opp.stunT > 0.3 || opp.frozenT > 0.3) return true;
    // they can't run back to the goal line during the wind-up
    if (oppFromGoal > 420 + (opp.dashCd <= 0 ? 120 : 0)) return true;
    // close range, with them not standing in the way
    return myFromGoal < 380 && (opp.x - me.x) * me.facing < 0;
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
    const b = this.ball;
    if (!this.allowKick || (this.match.phase !== 'playing' && this.match.phase !== 'goal')) return false;
    if (this.p.shotPick) return this.pickShot();
    const lead = KICK_LEAD + (this.difficulty === 'medium' ? rand(-0.02, 0.025) : 0);
    const bx = b.x + b.vx * lead;
    const by = b.y + b.vy * lead + 0.5 * BALL_GRAVITY * lead * lead;
    const dx = bx - (me.hipX + me.facing * 19 + me.vx * lead);
    const dy = by - (me.hipY + 8);
    const reach = b.r + me.footR + 18;
    const zone = inKickZone({ x: bx - me.vx * lead, y: by, r: b.r }, me);
    if (dx * dx + dy * dy > reach * reach && !zone) return false;
    return (bx - me.x) * me.facing >= 0;
  }

  // ------------------------------------------------------------ expert: shot selection

  /** where the ball will be in t seconds (no bounces: only used a fraction of a second ahead) */
  private ballAt(t: number): { x: number; y: number } {
    const b = this.ball;
    const g = BALL_GRAVITY * b.gravityScale * this.match.arena.env.ballGravity;
    return { x: b.x + b.vx * t, y: b.y + b.vy * t + 0.5 * g * t * t };
  }

  /** seconds until the ball reaches my swinging foot (null = not within the next swing) */
  private arrival(): number | null {
    const me = this.me;
    const b = this.ball;
    const reach = b.r + me.footR + 18;
    for (let t = 0; t <= KICK_FWD + 0.02; t += 1 / 240) {
      const p = this.ballAt(t);
      if ((p.x - me.x) * me.facing < 0) continue;
      const dx = p.x - (me.hipX + me.facing * 19 + me.vx * t);
      const dy = p.y - (me.hipY + 8);
      if (dx * dx + dy * dy <= reach * reach || inKickZone({ x: p.x - me.vx * t, y: p.y, r: b.r }, me)) return t;
    }
    return null;
  }

  /**
   * Expert kick: the moment the foot meets the ball decides the shot (early = low
   * drive, middle = full power, late = lob). Try each, fly it with the real physics
   * and press kick at the moment that gives the best shot.
   */
  private pickShot(): boolean {
    const ta = this.arrival();
    if (ta === null) return false;
    const reachNow = Math.max(0.18, Math.min(1, ta / KICK_FWD));
    if (ta <= 1 / 60) return true; // it's at the foot: kick now, whatever comes out
    const m = this.match;
    if (m.time - this.shotCacheAt > 0.04) {
      this.shotCacheAt = m.time;
      this.shotScores = SHOT_PHASES.map((ph) => this.scoreShot(ph));
      let best = 0;
      for (let i = 1; i < SHOT_PHASES.length; i++) if (this.shotScores[i] > this.shotScores[best]) best = i;
      this.shotBest = SHOT_PHASES[best];
    }
    // pressing now gives about `reachNow`; waiting only gives earlier (lower) contacts
    if (reachNow <= this.shotBest + 0.07) return true;
    // the better shot needs a later press than possible: is the one on offer now good enough?
    let nowScore = -Infinity;
    for (let i = 0; i < SHOT_PHASES.length; i++) if (Math.abs(SHOT_PHASES[i] - reachNow) < 0.07) nowScore = Math.max(nowScore, this.shotScores[i]);
    return nowScore >= Math.max(...this.shotScores) - 4;
  }

  /** How good a kick at this point of the swing would be (fly it and see). */
  private scoreShot(phase: number): number {
    const me = this.me;
    const m = this.match;
    const b = this.ball;
    const opp = m.players[1 - this.index];
    const f = me.facing;
    const at = this.ballAt(phase * KICK_FWD);
    // the same outcome as a real kick (see tryKick)
    const sweet = 1 - clamp(Math.abs(phase - 0.42) / 0.34, 0, 1);
    const power = 0.5 + 0.5 * sweet;
    let elev = 0.72 + (1.2 - 0.72) * clamp((phase - 0.18) / 0.82, 0, 1);
    if (at.y < me.hipY - 14) elev *= 0.55;
    const speed = (600 + 520 * power) * me.power * (me.fireT > 0 ? 1.22 : 1);
    const s = this.sim;
    s.x = at.x;
    s.y = Math.min(at.y, GROUND_Y - b.r);
    s.vx = f * Math.cos(elev) * speed + me.vx * 0.35;
    s.vy = -Math.sin(elev) * speed + Math.min(me.vy, 0) * 0.25;
    s.spin = -f * (8 + 22 * phase);
    s.r = b.r;
    s.gravityScale = b.gravityScale;
    s.dragScale = 1;
    const goalLine = f === 1 ? W - GOAL_DEPTH : GOAL_DEPTH;
    const goalTop = m.arena.goalTop[1 - this.index];
    const oppReachTop = opp.headY - opp.headR - 140; // what the opponent can reach with a jump
    let contested = false;
    for (let i = 0; i < 110; i++) {
      stepBall(s, m.arena, PRED_DT, this.impacts);
      const t = (i + 1) * PRED_DT;
      // in the goal
      if ((s.x - goalLine) * f > s.r && s.y > goalTop) return 100 - t * 12 - (contested ? 25 : 0);
      // straight into the opponent
      const dx = s.x - opp.headX;
      const dy = s.y - opp.headY;
      if (dx * dx + dy * dy < (s.r + opp.headR + 6) ** 2 || (Math.abs(s.x - opp.x) < s.r + opp.halfW && s.y > opp.headY && s.y < opp.y)) {
        return 10 + 20 * clamp(((s.x - me.x) * f) / W, 0, 1);
      }
      // within the opponent's jump: they may well head it away
      if (Math.abs(s.x - opp.x) < opp.halfW + s.r + 30 && s.y > oppReachTop) contested = true;
      // heading for my own goal
      if ((f === 1 ? s.x < GOAL_DEPTH : s.x > W - GOAL_DEPTH) && s.y > m.arena.goalTop[this.index]) return -100;
    }
    const gain = clamp(((s.x - me.x) * f) / W, -1, 1);
    return 30 + 35 * gain - (contested ? 15 : 0);
  }
}

/** points of the swing the expert considers (0.42 = the sweet spot) */
const SHOT_PHASES = [0.18, 0.28, 0.42, 0.56, 0.7, 0.85];

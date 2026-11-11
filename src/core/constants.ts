// Logical world size. Everything is simulated and drawn in these units,
// then scaled to the real canvas size.
export const W = 1280;
export const H = 720;

/**
 * The visible area in world units. The pitch (0..W, 0..H) always fits; on a
 * wider or taller screen the stadium simply continues past it (no black bars),
 * so this rect can start at negative coordinates. Set by the renderer on resize.
 */
export const SCREEN = { x: 0, y: 0, w: W, h: H };

// Pitch
export const GROUND_Y = 630; // the line players stand on
export const GRASS_TOP = 500; // far edge of the grass (visual only)

// Goals (side view: the goal mouth is the strip between the wall and the goal line)
export const GOAL_DEPTH = 96; // distance from the side wall to the goal line
export const GOAL_HEIGHT = 206;
export const GOAL_TOP = GROUND_Y - GOAL_HEIGHT;
export const BAR_THICK = 14;

// Simulation
export const SIM_HZ = 120;
export const DT = 1 / SIM_HZ;

// Ball
export const BALL_R = 21;
/** low: the ball floats like a beach ball */
export const BALL_GRAVITY = 900;
export const MAX_BALL_SPEED = 1900;

// Players
export const PLAYER_GRAVITY = 2700;
export const START_X: [number, number] = [330, W - 330];

// Fonts
export const FONT_DISPLAY = '"Russo One", "Arial Black", Impact, sans-serif';
export const FONT_TEXT = '"Rubik", system-ui, sans-serif';

// Shared palette
export const INK = '#16122b'; // outline colour used for the cartoon look

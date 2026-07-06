import { Vec2, Box } from 'planck';
import type { World, Body } from 'planck';
import { toMeters } from '../physics/world.js';

const WALL_THICKNESS_PX = 40;
const ARENA_W = 1920;
const ARENA_H = 1080;

export const BOSS_ARENA_SPAWN_POINTS = [
  { x: 960,  y: 100  },  // north
  { x: 960,  y: 980  },  // south
  { x: 120,  y: 540  },  // west
  { x: 1800, y: 540  },  // east
] as const satisfies ReadonlyArray<{ x: number; y: number }>;

export function loadBossArena(world: World): Body[] {
  const hw = toMeters(ARENA_W / 2);
  const hh = toMeters(ARENA_H / 2);
  const cx = toMeters(ARENA_W / 2);
  const cy = toMeters(ARENA_H / 2);
  const t  = toMeters(WALL_THICKNESS_PX / 2);

  const top = world.createBody({ type: 'static', position: Vec2(cx, toMeters(WALL_THICKNESS_PX / 2)) });
  top.createFixture({ shape: Box(hw, t) });

  const bot = world.createBody({ type: 'static', position: Vec2(cx, toMeters(ARENA_H - WALL_THICKNESS_PX / 2)) });
  bot.createFixture({ shape: Box(hw, t) });

  const lft = world.createBody({ type: 'static', position: Vec2(toMeters(WALL_THICKNESS_PX / 2), cy) });
  lft.createFixture({ shape: Box(t, hh) });

  const rgt = world.createBody({ type: 'static', position: Vec2(toMeters(ARENA_W - WALL_THICKNESS_PX / 2), cy) });
  rgt.createFixture({ shape: Box(t, hh) });

  // ponytail: no corner notching — add diagonal corner bodies if corner-sticking observed in playtest
  return [top, bot, lft, rgt];
}

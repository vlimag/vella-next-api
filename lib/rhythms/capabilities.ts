export type RhythmsCapability = {
  journey_v2: boolean;
  practices: boolean;
  gatherings: boolean;
  social_badges: boolean;
  long_journeys: boolean;
};

const PHASES = [
  'off',
  'foundation',
  'journey_v2',
  'practices',
  'gatherings',
  'social_badges',
  'long_journeys',
] as const;

type RhythmsPhase = typeof PHASES[number];

function configuredPhase(): RhythmsPhase {
  const value = process.env.VELLA_RHYTHMS_PHASE;
  return PHASES.includes(value as RhythmsPhase) ? value as RhythmsPhase : 'off';
}

export function resolveRhythmsCapabilities(): RhythmsCapability {
  const phaseIndex = PHASES.indexOf(configuredPhase());

  return {
    journey_v2: phaseIndex >= PHASES.indexOf('journey_v2'),
    practices: phaseIndex >= PHASES.indexOf('practices'),
    gatherings: phaseIndex >= PHASES.indexOf('gatherings'),
    social_badges: phaseIndex >= PHASES.indexOf('social_badges'),
    long_journeys: phaseIndex >= PHASES.indexOf('long_journeys'),
  };
}

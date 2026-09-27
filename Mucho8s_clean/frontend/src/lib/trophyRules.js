export const MAX_TROPHY_LEVEL = 10;

export const TROPHY8S_RULES = {
  veteran: {
    id: "veteran",
    title: "Veteran",
    emoji: "🧱",
    baseGoal: 40,
    baseReward: 5,
    unit: " matches",
    description: "Play Mucho8s matches",
  },
  "money-maker": {
    id: "money-maker",
    title: "Money Maker",
    emoji: "💰",
    baseGoal: 50,
    baseReward: 5,
    unit: " €",
    description: "Win value through Mucho8s money pairings",
  },
  "high-roller": {
    id: "high-roller",
    title: "High Roller",
    emoji: "💎",
    baseGoal: 20,
    baseReward: 8,
    unit: " €",
    description: "Win a single Mucho8s pairing worth at least the target",
  },
  rivalry: {
    id: "rivalry",
    title: "Rivalry",
    emoji: "⚔️",
    baseGoal: 8,
    baseReward: 4,
    unit: " meetings",
    description: "Meet the same player in Mucho8s",
  },
  nemesis: {
    id: "nemesis",
    title: "Nemesis",
    emoji: "👑",
    baseGoal: 4,
    baseReward: 6,
    unit: " wins",
    description: "Beat the same player in Mucho8s",
  },
  "run-it-back": {
    id: "run-it-back",
    title: "Run It Back",
    emoji: "🔄",
    baseGoal: 1,
    baseReward: 3,
    unit: " comebacks",
    description: "Lose to a player, then beat them in the next meeting",
  },
  "on-fire": {
    id: "on-fire",
    title: "On Fire",
    emoji: "🔥",
    baseGoal: 4,
    baseReward: 6,
    unit: " wins",
    description: "Reach a Mucho8s win streak",
  },
  unstoppable: {
    id: "unstoppable",
    title: "Unstoppable",
    emoji: "☢️",
    baseGoal: 8,
    baseReward: 10,
    unit: " wins",
    description: "Reach an elite Mucho8s win streak",
  },
  "clean-sweep": {
    id: "clean-sweep",
    title: "Clean Sweep",
    emoji: "🧹",
    baseGoal: 1,
    baseReward: 7,
    unit: " sweeps",
    description: "Complete 4-win Mucho8s sweep milestones",
  },
};

export const trophyGoalForLevel = (rule, level) =>
  Number(rule?.baseGoal || 1) * Math.max(1, Number(level || 1));

export const trophyRewardForLevel = (rule, level) =>
  Math.min(
    15,
    Math.max(3, Number(rule?.baseReward || 3) + Math.max(0, Number(level || 1) - 1))
  );

export const trophyLevelForValue = (rule, value) =>
  Math.min(
    MAX_TROPHY_LEVEL,
    Math.max(0, Math.floor(Number(value || 0) / Math.max(1, Number(rule?.baseGoal || 1))))
  );

export const trophyNextTier = (rule, value) => {
  const level = trophyLevelForValue(rule, value);
  if (level >= MAX_TROPHY_LEVEL) {
    return {
      level,
      nextLevel: null,
      goal: trophyGoalForLevel(rule, MAX_TROPHY_LEVEL),
      reward: trophyRewardForLevel(rule, MAX_TROPHY_LEVEL),
      complete: true,
      progress: 100,
    };
  }

  const nextLevel = level + 1;
  const previousGoal = level > 0 ? trophyGoalForLevel(rule, level) : 0;
  const goal = trophyGoalForLevel(rule, nextLevel);
  const span = Math.max(1, goal - previousGoal);
  const progress = Math.min(
    100,
    Math.max(0, Math.round(((Number(value || 0) - previousGoal) / span) * 100))
  );

  return {
    level,
    nextLevel,
    goal,
    reward: trophyRewardForLevel(rule, nextLevel),
    complete: false,
    progress,
  };
};

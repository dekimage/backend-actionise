const CONFIG = {
  API_PATH: "api::usercard.usercard",
  PROGRAM_COMPLETED_MAX: 3,
  XP_FROM_QUEST: 50,
  STARS_REWARD_FROM_RATING: 25,
  STARS_REWARD_FROM_BUDDY_REWARD: 400,
  STARS_REWARD_FROM_FAQ: 10,
  RARITY_TABLE: {
    common: 60,
    rare: 85,
    epic: 95,
    legendary: 100,
  },
  STARS_BY_RARITY: {
    common: 50,
    rare: 75,
    epic: 125,
    legendary: 250,
  },
  INCREASE_PER_LEVEL: 3.29,
  STARTING_XP: 300,
  XP_PER_OBJECTIVE: { daily: 75, weekly: 250 },
  DEFAULT_ENERGY: 10,
  CHANCE_TO_GAIN_ARTIFACT: 0.99, // 0.166; 16.6% chance
  MAX_COMPLETED_CARDS: 10,

  ARTIFACTS_TABLE: {
    cards_complete: [5, 10, 25, 50, 75, 100, 200, 300, 500, 1000],
    card_unlock: [3, 5, 10, 20, 30, 40],
    daily_objectives_complete: [15, 30, 75, 100, 150, 250],
    weekly_objectives_complete: [5, 15, 25],
  },
  CARD_RATINGS: [1, 2, 3, 4, 5],
  TUTORIAL_MAX_STEPS: 5,
  MAX_USER_FEEDBACK: 25,
  EMAIL: "contact@actionise.com",
  DEFAULT_SUBJECT: "New Feedback",
  ALLOWED_EMAILS: ["dejan.gavrilovikk@gmail.com", "denar@gmail.com"],
};

const TYPES = {
  SETTINGS_BASICINFO_TYPES: ["username", "age", "gender"],
  FEEDBACK_TYPES: {
    rating: "rating",
    feedback: "feedback",
  },
  NOTIFICATION_KEYS: [
    "newsletter",
    "promotions",
    "content",
    "updates",
    "reminders",
    "unsubscribe",
  ],
  OBJECTIVE_REWARD_TYPES: {
    streak: "streak",
    stars: "stars",
    loot: "loot",
  },
  OBJECTIVE_TIME_TYPES: {
    daily: "daily",
    weekly: "weekly",
  },
  OBJECTIVE_REQUIREMENT_TYPES: {
    login: "login",
  },
  OBJECTIVE_TRIGGERS: {
    energy: "energy",
    complete: "complete",
  },
  ARTIFACT_TRIGGERS: {
    daily: "daily_objectives_complete",
    weekly: "weekly_objectives_complete",
    cardsComplete: "cards_complete",
    cardsUnlock: "card_unlock",
  },
  PRODUCT_TYPES: {
    gems: "gems",
    bundle: "bundle",
    subscription: "subscription",
  },
  STREAK_REWARD_TYPES: {
    stars: "stars",
  },
  PAYMENT_ENV_TYPES: {
    android: "android",
    ios: "ios",
    cpay: "cpay",
  },
};

API_ACTIONS = {
  updateCard: {
    complete: "complete",
    unlock: "unlock",
    favorite: "favorite",
  },
  updateContentType: {
    save: "save",
    complete: "complete",
    claim: "claim",
    removeNew: "removeNew",
  },
};

const USER = {
  DEFAULT_USER_STATS: {
    mastery: 0,
    card_unlock: 0,
    cards_complete: 0,
    claimed_artifacts: 0,
    daily_objectives_complete: 0,
    weekly_objectives_complete: 0,
  },
  TEST_USER_DATA: {
    level: 30,
    xp: 0,
    stars: 10000,
    energy: 1000,
    streak: 100,
    highest_buddy_shares: 10,
    is_notify_me: false,
    objectives_json: {
      1: { progress: 15, isCollected: false },
      2: { progress: 15, isCollected: false },
      3: { progress: 15, isCollected: false },
      4: { progress: 15, isCollected: false },
      5: { progress: 15, isCollected: false },
      6: { progress: 15, isCollected: false },
      7: { progress: 15, isCollected: false },
      8: { progress: 15, isCollected: false },
    },
    stats: this.DEFAULT_USER_STATS,
    card_tickets: [],
    droppedContent: {},
    avatar: 1,
    artifacts: [],
    claimed_artifacts: [],
    favorite_cards: [],
    tutorial_step: 0,
    shared_by: [],
    shared_buddies: [],
    last_unlocked_cards: [],
    last_completed_cards: [],
    streak_rewards: {},
    friends_rewards: {},
    rewards_tower: {},
    email_preferences: {
      newsletter: true,
      promotions: true,
      content: true,
      updates: true,
      reminders: true,
      unsubscribe: false,
    },
  },
};

const C_TYPES = {
  DEFAULT_PROGRESS_QUEST: {
    level: 1,
    progress: 0,
    claimsAvailable: 0,
  },
  DEFAULT_PROGRESS_MAP: {
    completed: 0,
    saved: false,
    isNew: true,
  },
  CONTENT_MAP: {
    ideas: { max: 3, color: "#bde0fe", single: "idea" },
    exercises: { max: 5, color: "#f4a261", single: "exercise" },
    stories: { max: 1, color: "#80ed99", single: "story" },
    casestudies: { max: 1, color: "#d4a373", single: "casestudy" },
    tips: { max: 3, color: "#766153", single: "tip" },
    metaphores: { max: 3, color: "#ecf39e", single: "metaphore" },
    experiments: { max: 2, color: "#f7ede2", single: "experiment" },
    expertopinions: { max: 3, color: "#e07a5f", single: "expertopinion" },
    quotes: { max: 5, color: "#f2cc8f", single: "quote" },
    questions: { max: 3, color: "#415a77", single: "question" },
  },
};
module.exports = {
  CONFIG,
  C_TYPES,
  USER,
  TYPES,
  API_ACTIONS,
};

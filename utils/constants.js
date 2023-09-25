const CONFIG = {
  API_PATH: "api::usercard.usercard",
  TICKET_PRICE: 5,
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
  DEFAULT_ENERGY: 30,
  CHANCE_TO_GAIN_ARTIFACT: 0.99, //TODO testing-  0.166; 16.6% chance
  MAX_COMPLETED_CARDS: 10,

  ARTIFACTS_TABLE: {
    cards_complete: [5, 10, 25, 50, 75, 100, 200, 300, 500, 1000],
    card_unlock: [3, 5, 10, 20, 30, 40],
    daily_objectives_complete: [15, 30, 75, 100, 150, 250],
    weekly_objectives_complete: [5, 15, 25],
  },

  CARD_RATINGS: [1, 2, 3, 4, 5],
  TUTORIAL_MAX_STEPS: 10,
  STARS_FROM_TUTORIAL: {
    1: 10,
    2: 20,
    3: 30,
    4: 40,
    5: 50,
    6: 60,
    7: 70,
    8: 80,
    9: 90,
    10: 100,
  },
  STARS_FROM_CALENDAR: {
    1: 50,
    2: 100,
    3: 200,
    4: 400,
    5: 600,
    6: 800,
    7: 1000,
  },
  MAX_USER_FEEDBACK: 25,
  EMAIL: "contact@actionise.com",
  DEFAULT_SUBJECT: "New Feedback",
  ALLOWED_EMAILS: ["dejan.gavrilovikk@gmail.com", "denar@gmail.com"],
};

const TYPES = {
  SETTINGS_BASICINFO_TYPES: ["username", "age", "gender"],
  FEEDBACK_TYPES: {
    rating: "rating",
    message: "message",
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
    master_card: "master_card",
    action: "action", // claim quest
  },
  // 4 not done, the rest are done, but need testing,
  // also i changed gql and usercard redux types to also get artifact hope they work
  // a ton of changes in backend with these mastery types, hope they work well too
  STATS_OPTIONS: {
    mastery: "mastery", // not done
    card_unlock: "card_unlock",
    cards_complete: "cards_complete", // not done
    total_energy_spent: "total_energy_spent", // not done
    daily: "daily_objectives_complete",
    weekly: "weekly_objectives_complete",
    quests_claimed: "quests_claimed",
    purchases_made: "purchases_made",
    pro_buy: "pro_buy",
    // contentTypes
    ideas: "ideas_completed",
    exercises: "exercises_completed",
    stories: "stories_completed",
    casestudies: "casestudies_completed",
    metaphores: "metaphores_completed",
    questions: "questions_completed",
    // tips: "tips_completed",
    // experiments: "experiments_completed",
    // expertopinions: "expertopinions_completed",
    // quotes: "quotes_completed",
    // ^ above have achievement, below have no achievement
    first_bonus: "first_bonus",
    claimed_artifacts: "claimed_artifacts",
    rated_cards: "rated_cards",
    feedback_cards: "feedback_cards",
    faqs_claimed: "faqs_claimed",
  },
  PRODUCT_TYPES: {
    energy: "energy",
    bundle: "bundle",
    stars: "stars",
    subscription: "subscription",
  },
  STREAK_REWARD_TYPES: {
    stars: "stars",
  },
  PAYMENT_ENV_TYPES: {
    android: "android",
    ios: "apple",
    cpay: "cpay",
  },
  TUTORIAL_STEPS: {
    complete_card: 1,
    complete_action: 2,
    complete_objective: 3,
    complete_daily_objective: 4,
    complete_weekly_objective: 5,
    complete_streak: 6,
    complete_friends: 7,
    complete_artifact: 8,
    complete_level: 9,
    complete_tutorial: 10,
  },
  TUTORIAL_TYPES: {
    complete_card: "complete_card",
    complete_action: "complete_action",
    complete_objective: "complete_objective",
    complete_daily_objective: "complete_daily_objective",
    complete_weekly_objective: "complete_weekly_objective",
    complete_streak: "complete_streak",
    complete_friends: "complete_friends",
    complete_artifact: "complete_artifact",
    complete_level: "complete_level",
    complete_tutorial: "complete_tutorial",
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
    mastery: 0, // not done
    card_unlock: 0,
    cards_complete: 0, // not done
    total_energy_spent: 0, // not done
    daily_objectives_complete: 0,
    weekly_objectives_complete: 0,
    quests_claimed: 0,
    purchases_made: 0,
    pro_buy: false,
    // contentTypes
    ideas_completed: 0,
    exercises_completed: 0,
    stories_completed: 0,
    casestudies_completed: 0,
    metaphores_completed: 0,
    questions_completed: 0,
    // experiments_completed: 0,
    // expertopinions_completed: 0,
    // tips_completed: 0,
    // quotes_completed: 0,
    // ^ above have achievement, below have no achievement
    first_bonus: false,
    claimed_artifacts: 0,
    rated_cards: 0,
    feedback_cards: 0,
    faqs_claimed: 0,
  },
  TEST_USER_DATA: {
    level: 30,
    xp: 0,
    stars: 10000,
    energy: 1000,
    streak: 100,
    highest_streak: 100,
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
      9: { progress: 15, isCollected: false },
      10: { progress: 15, isCollected: false },
      11: { progress: 15, isCollected: false },
      12: { progress: 15, isCollected: false },
      13: { progress: 15, isCollected: false },
      14: { progress: 15, isCollected: false },
      15: { progress: 15, isCollected: false },
    },
    stats: this.DEFAULT_USER_STATS,
    card_tickets: [],
    droppedContent: {},
    avatar: 1,
    artifacts: [],
    claimed_artifacts: [],
    favorite_cards: [],
    tutorial: {
      step: 1,
      progress: 0,
      isCompleted: false,
    },
    shared_by: [],
    shared_buddies: [],
    unlocked_cards: [],
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
    ideas: { max: 3, single: "idea" },
    exercises: { max: 5, single: "exercise" },
    stories: { max: 1, single: "story" },
    casestudies: { max: 1, single: "casestudy" },
    metaphores: { max: 3, single: "metaphore" },
    questions: { max: 3, single: "question" },
    // tips: { max: 3, single: "tip" },
    // experiments: { max: 2, single: "experiment" },
    // expertopinions: { max: 3, single: "expertopinion" },
    // quotes: { max: 5, single: "quote" },
  },
};
module.exports = {
  CONFIG,
  C_TYPES,
  USER,
  TYPES,
  API_ACTIONS,
};

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/usercard/me",
      handler: "usercard.me",
    },
    {
      method: "PUT",
      path: "/usercard/collect-level-reward/:id",
      handler: "usercard.collectLevelReward",
    },
    {
      method: "PUT",
      path: "/usercard/collect-streak-reward/:id",
      handler: "usercard.collectStreakReward",
    },
    {
      method: "PUT",
      path: "/usercard/collect-friends-reward/:id",
      handler: "usercard.collectFriendsReward",
    },
    {
      method: "PUT",
      path: "/usercard/update-card/:id",
      handler: "usercard.updateCard",
    },
    {
      method: "PUT",
      path: "/usercard/purchase-box/:id",
      handler: "usercard.purchaseLootBox",
    },
    {
      method: "PUT",
      path: "/usercard/open-pack/:id",
      handler: "usercard.openPack",
    },
    {
      method: "PUT",
      path: "/usercard/purchase-expansion/:id",
      handler: "usercard.purchaseExpansion",
    },
    {
      method: "PUT",
      path: "/usercard/purchase-product/:id",
      handler: "usercard.purchaseProduct",
    },
    {
      method: "PUT",
      path: "/usercard/collect-objective-reward/:id",
      handler: "usercard.claimObjective",
    },
    //---
    {
      method: "PUT",
      path: "/usercard/collect-objective-counter-reward/:id",
      handler: "usercard.claimObjectiveCounter",
    },
    {
      method: "PUT",
      path: "/usercard/cancel-subscription/:id",
      handler: "usercard.cancelSubscription",
    },
    {
      method: "PUT",
      path: "/usercard/follow-buddy/:id",
      handler: "usercard.followBuddy",
    },
  ],
};

module.exports = {
  routes: [
    {
      method: "PUT",
      path: "/usercard/reset-user",
      handler: "usercard.resetUser",
    },
    {
      method: "PUT",
      path: "/usercard/notify-me",
      handler: "usercard.notifyMe",
    },
    {
      method: "PUT",
      path: "/usercard/rate-card",
      handler: "usercard.rateCard",
    },
    {
      method: "GET",
      path: "/usercard/me",
      handler: "usercard.me",
    },
    {
      method: "PUT",
      path: "/usercard/update-tutorial/:tutorialStep",
      handler: "usercard.updateTutorial",
    },
    {
      method: "PUT",
      path: "/usercard/getRandomCard",
      handler: "usercard.getRandomCard",
    },
    {
      method: "PUT",
      path: "/usercard/claim-artifact/:id",
      handler: "usercard.claimArtifact",
    },
    {
      method: "PUT",
      path: "/usercard/buyCardTicket/:id",
      handler: "usercard.buyCardTicket",
    },
    {
      method: "PUT",
      path: "/usercard/skip-action",
      handler: "usercard.skipAction",
    },
    {
      method: "PUT",
      path: "/usercard/save-avatar/:id",
      handler: "usercard.saveAvatar",
    },
    {
      method: "PUT",
      path: "/usercard/accept-referral",
      handler: "usercard.acceptReferral",
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
      path: "/usercard/purchase-product/:id",
      handler: "usercard.purchaseProduct",
    },
    {
      method: "PUT",
      path: "/usercard/collect-objective-reward/:id",
      handler: "usercard.claimObjective",
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

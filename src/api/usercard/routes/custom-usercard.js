module.exports = {
  routes: [
    {
      method: "PUT",
      path: "/usercard/update-content-type",
      handler: "usercard.updateContentType",
    },
    {
      method: "PUT",
      path: "/usercard/update-settings",
      handler: "usercard.updateSettings",
    },
    {
      method: "PUT",
      path: "/usercard/send-feature-mail",
      handler: "usercard.sendFeatureMail",
    },
    {
      method: "PUT",
      path: "/usercard/update-user-basic-info",
      handler: "usercard.updateUserBasicInfo",
    },
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
      path: "/usercard/update-tutorial",
      handler: "usercard.updateTutorial",
    },
    {
      method: "PUT",
      path: "/usercard/get-random-card",
      handler: "usercard.getRandomCard",
    },
    {
      method: "PUT",
      path: "/usercard/claim-artifact",
      handler: "usercard.claimArtifact",
    },

    {
      method: "PUT",
      path: "/usercard/save-avatar",
      handler: "usercard.saveAvatar",
    },
    {
      method: "PUT",
      path: "/usercard/accept-referral",
      handler: "usercard.acceptReferral",
    },
    {
      method: "PUT",
      path: "/usercard/collect-level-reward",
      handler: "usercard.collectLevelReward",
    },
    {
      method: "PUT",
      path: "/usercard/collect-streak-reward",
      handler: "usercard.collectStreakReward",
    },
    {
      method: "PUT",
      path: "/usercard/collect-friends-reward",
      handler: "usercard.collectFriendsReward",
    },
    {
      method: "PUT",
      path: "/usercard/update-card",
      handler: "usercard.updateCard",
    },
    {
      method: "PUT",
      path: "/usercard/purchase-product",
      handler: "usercard.purchaseProduct",
    },
    {
      method: "PUT",
      path: "/usercard/claim-objective",
      handler: "usercard.claimObjective",
    },

    {
      method: "PUT",
      path: "/usercard/cancel-subscription",
      handler: "usercard.cancelSubscription",
    },
    {
      method: "PUT",
      path: "/usercard/follow-buddy",
      handler: "usercard.followBuddy",
    },
  ],
};

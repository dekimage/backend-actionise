module.exports = {
  routes: [
    {
      method: "PUT",
      path: "/communityactions/interact/:id",
      handler: "communityaction.interact",
    },
  ],
};

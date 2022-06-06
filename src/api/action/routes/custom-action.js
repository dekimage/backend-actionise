module.exports = {
  routes: [
    {
      method: "PUT",
      path: "/actions/complete/:id",
      handler: "action.complete",
    },
  ],
};

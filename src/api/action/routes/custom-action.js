module.exports = {
  routes: [
    {
      // Path defined with a URL parameter
      method: "PUT",
      path: "/actions/complete/:id",
      handler: "action.complete",
    },
    {
      method: "PUT",
      path: "/actions/test/:id",
      handler: "action.test",
    },
  ],
};

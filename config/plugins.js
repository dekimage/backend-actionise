module.exports = ({ env }) => {
  if (env("NODE_ENV") === "production") {
    return {
      documentation: {
        enabled: false,
      },
      upload: {
        config: {
          provider: "aws-s3",
          providerOptions: {
            accessKeyId: env("AWS_ACCESS_KEY_ID"),
            secretAccessKey: env("AWS_ACCESS_SECRET"),
            region: env("AWS_REGION"),
            params: {
              Bucket: env("AWS_BUCKET"),
            },
          },
        },
      },
      email: {
        config: {
          provider: "sendgrid",
          providerOptions: {
            apiKey: env("SENDGRID_API_KEY"),
          },
          settings: {
            defaultFrom: "contact@actionise.com",
            defaultReplyTo: "contact@actionise.com",
            testAddress: "dejan.gavrilovikk@gmail.com",
          },
        },
      },
      "strapi-google-auth": {
        enabled: true,
      },
    };
  }
  return {
    "strapi-google-auth": {
      enabled: true,
    },
    documentation: {
      enabled: false,
    },
    email: {
      config: {
        provider: "sendgrid",
        providerOptions: {
          apiKey: env("SENDGRID_API_KEY"),
        },
        settings: {
          defaultFrom: "contact@actionise.com",
          defaultReplyTo: "contact@actionise.com",
          testAddress: "dejan.gavrilovikk@gmail.com",
        },
      },
    },
  };
};

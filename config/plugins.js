module.exports = ({ env }) => {
  if (env("NODE_ENV") === "production") {
    return {
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
      "google-auth": {
        enabled: true,
      },
    };
  }
  return {
    "strapi-google-auth": {
      enabled: true,
    },
    //By empty object we specify system default - strapi local upload
  };
};

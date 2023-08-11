// const path = require("path");

// module.exports = ({ env }) => ({
//   connection: {
//     client: 'sqlite',
//     connection: {
//       filename: path.join(__dirname, '..', env('DATABASE_FILENAME', '.tmp/data.db')),
//     },
//     useNullAsDefault: true,
//   },
// });

module.exports = ({}) => ({
  connection: {
    client: "postgres",
    connection: {
      host: "localhost",
      port: 5432,
      database: "my_local_dbname",
      user: "postgres",
      password: "lopovakreM537",
    },
    debug: false,
  },
});

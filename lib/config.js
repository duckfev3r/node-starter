/*
 * Create and export environment variables...
*/

const environments = {};

// staging (default) object

environments.staging = {
  httpPort: 3000,
  httpsPort: 3001,
  maxChecks: 5,
  envName: "staging",
  twilio : {
    accountSid : 'ACc83ce1df593377b67c72c5acae905f8c',
    authToken : '3c307403596a3589068e615e8d57ddb5',
    fromPhone : '+16173133401 '
  },
  hashingSecret: "dkjehtgoeijdadgkdf,mnsfp04129dj"
};

// production object

environments.production = {
  httpPort: 5000,
  httpsPort: 5001,
  maxChecks: 5,
  envName: "production",
  hashingSecret: "dkjehtgoeijdadgkdf,mnsfp04129dj"
};

// Determine which environment was passed as a command-line argument

if(process.env.NODE_ENV) {
 console.log(`Node ENV : ${process.env.NODE_ENV}`)
}
else {
  console.log('No env detected. Defaulting to Staging.')
}
const currentEnv =
  typeof process.env.NODE_ENV == "string"
    ? process.env.NODE_ENV.toLowerCase()
    : "";

// Check that the current environment is one of the envs defined above, if not - default to staging.

const environmentToExport =
  typeof environments[currentEnv] == "object"
    ? environments[currentEnv]
    : environments.staging;

// Export the module
module.exports = environmentToExport;

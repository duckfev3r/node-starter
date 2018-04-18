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
    accountSid : '',
    authToken : '',
    fromPhone : ' '
  },
  hashingSecret: ""
};

// production object

environments.production = {
  httpPort: 5000,
  httpsPort: 5001,
  maxChecks: 5,
  envName: "production",
  hashingSecret: ""
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

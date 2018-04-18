/*
 *
 * Helpers for various tasks
 */

// Dependencies

const crypto = require("crypto");
const config = require("./config");
const https = require('https')
const querystring = require('querystring')

var helpers = {};

// Create a SHA256 Hash

helpers.hash = function (str) {
  if (typeof str == "string" && str.length > 0) {
    const hash = crypto
      .createHmac("sha256", config.hashingSecret)
      .update(str)
      .digest("hex");
    return hash;
  } else {
    return false;
  }
};

// Parse a json string to an object in all cases without throwing

helpers.parseJsonToObject = function (str) {
  try {
    const object = JSON.parse(str);
    return object;
  } catch (er) {
    return {};
  }
};

// Create a string of random alphanumeric characters of a set length

helpers.createRandomString = function (strLength) {
  strLength = typeof strLength == "number" && strLength > 0 ? strLength : false;
  if (strLength) {
    // Define all the possible characters that could go into a string.
    const possibleCharacters = "abcdefghijklmnopqrstuvwxyz0123456789";
    let str = ''
    for (i = 1; i <= strLength; i++) {
      // Get a random character from the possible characters string, append this character to the string.
      const randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length))
      str += randomCharacter
    }
    return str
  } else {
    return false;
  }
};

helpers.sendTwilioSms = function (phone, msg, callback) {
  phone = typeof (phone) == 'string' && phone.trim().length > 0 ? phone.trim() : false
  msg = typeof (msg) == 'string' && msg.trim().length > 0 && msg.trim().length < 1600 ? msg.trim() : false
  if (phone && msg) {
    // Configure request payload
    const payload = {
      'From': config.twilio.fromPhone,
      'To': `+353${phone}`,
      'Body': msg
    }
    console.log(JSON.stringify(payload))
    // Stringify the payload
    const stringPayload = querystring.stringify(payload)
    // Configure the request details
    const requestDetails = {
      protocol: 'https:',
      hostname: 'api.twilio.com',
      method: 'POST',
      path: `/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`,
      auth: `${config.twilio.accountSid}:${config.twilio.authToken}`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(stringPayload)
      }
    }
    // Instantiate the request object
    const req = https.request(requestDetails, function (res) {
      // Grab the status of the sent request
      var status = res.statusCode
      // Call back succcessfully if the request went through
      if (status == 200 || status == 201) {
        callback(false)
      }
      else {
        callback(`Status Code Returned was : ${status}`)
      }
    })

    // Bind to error event if error is thrown
    req.on('error', function (e) {
      callback(e)
    })
    // Add the payload.
    req.write(stringPayload)
    // End the request.
    req.end()
  }
  else {
    callback('Given parameters were invalid.')
  }
}

module.exports = helpers;

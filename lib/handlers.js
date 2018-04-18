/*
 * These are the request handlers
 */

// Dependencies

const _data = require("./data");
const helpers = require("./helpers");
const config = require("./config");

// Define Handlers

const handlers = {};

// Default Handler

handlers.notFound = function (data, callback) {
  callback(404);
};

// Ping Handler

handlers.ping = function (data, callback) {
  callback(200);
};

handlers.users = function (data, callback) {
  const acceptableMethods = ["post", "get", "put", "delete"];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._users[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for users sub-methods

handlers._users = {};

// Required fields = firstName, lastName, password, tosAgreement, phone

handlers._users.post = function (data, callback) {
  // check all required fields are filled out
  const firstName =
    typeof data.payload.firstName == "string" &&
    data.payload.firstName.trim().length > 0 ?
    data.payload.firstName.trim() :
    false;
  const lastName =
    typeof data.payload.lastName == "string" &&
    data.payload.lastName.trim().length > 0 ?
    data.payload.lastName.trim() :
    false;
  const phone =
    typeof data.payload.phone == "string" &&
    data.payload.phone.trim().length > 0 ?
    data.payload.phone.trim() :
    false;
  const password =
    typeof data.payload.password == "string" &&
    data.payload.password.trim().length > 0 ?
    data.payload.password.trim() :
    false;
  const tosAgreement =
    typeof data.payload.tosAgreement == "boolean" &&
    data.payload.tosAgreement == true ?
    data.payload.tosAgreement :
    false;

  if (firstName && lastName && phone && password && tosAgreement) {
    // Make sure user doesn't already exist
    _data.read("users", phone, function (err, data) {
      if (err) {
        // Hash password
        const hashedPassword = helpers.hash(password);

        // Create user object
        if (hashedPassword) {
          const userObject = {
            firstName: firstName,
            lastName: lastName,
            phone: phone,
            hashedPassword: hashedPassword,
            tosAgreement: tosAgreement
          };

          _data.create("users", phone, userObject, function (err) {
            if (!err) {
              callback(200);
            } else {
              console.log(err);
              callback(500, {
                Error: "A user with that phone number already exists"
              });
            }
          });
        } else {
          callback(500, {
            Error: "Hashing password failed !"
          });
        }
      } else {
        callback(400, {
          Error: "a user with that phone number already exists."
        });
      }
    });
  } else {
    callback(400, {
      Error: "Missing required fields"
    });
  }
};

// Users GET
// Required Data : phone
// Optional Data : none

handlers._users.get = function (data, callback) {
  // Check that phone number is valid
  const phone =
    typeof data.queryStringObject.phone == "string" &&
    data.queryStringObject.phone.trim().length > 1 ?
    data.queryStringObject.phone.trim() :
    false;
  if (phone) {
    // Get the token from the headers
    const token =
      typeof data.headers.token == "string" ? data.headers.token : false;
    // Verify that the given token from the headers if valid for the phone number
    handlers._tokens.verifyToken(token, phone, function (tokenIsValid) {
      if (tokenIsValid) {
        _data.read("users", phone, function (err, data) {
          if (!err && data) {
            // Remove the hashed password from the user object before returning it to the requester.
            delete data.hashedPassword;
            callback(200, data);
          } else {
            callback(404);
          }
        });
      } else {
        callback(403, {
          Error: "Missing required token in header or token is invalid."
        });
      }
    });
  } else {
    callback(400, {
      Error: "Missing Required Field"
    });
  }
};

// Users : PUT
// Required data : phone
// optional data : firstName, lastName, password (at least one must be specified)
// only let an authenticated user update their own object, don't let anyone else
handlers._users.put = function (data, callback) {
  // check for the required field
  const phone =
    typeof data.payload.phone == "string" &&
    data.payload.phone.trim().length > 1 ?
    data.payload.phone.trim() :
    false;
  const firstName =
    typeof data.payload.firstName == "string" &&
    data.payload.firstName.trim().length > 0 ?
    data.payload.firstName.trim() :
    false;
  const lastName =
    typeof data.payload.lastName == "string" &&
    data.payload.lastName.trim().length > 0 ?
    data.payload.lastName.trim() :
    false;
  const password =
    typeof data.payload.password == "string" &&
    data.payload.password.trim().length > 0 ?
    data.payload.password.trim() :
    false;

  // Error is phone is invalid, only continue if phone is good
  if (phone) {
    if (firstName || lastName || password) {
      // Get the token from the headers
      const token =
        typeof data.headers.token == "string" ? data.headers.token : false;
      // Verify that the given token from the headers if valid for the phone number
      handlers._tokens.verifyToken(token, phone, function (tokenIsValid) {
        if (tokenIsValid) {
          _data.read("users", phone, function (err, userData) {
            if (!err && userData) {
              if (firstName) {
                userData.firstName = firstName;
              }
              if (lastName) {
                userData.lastName = lastName;
              }
              if (password) {
                userData.hashedPassword = helpers.hash(password);
              }
              console.log(userData);
              // Store updated data

              _data.update("users", phone, userData, function (err) {
                if (!err) {
                  callback(200);
                } else {
                  console.log(err);
                  callback(500, {
                    Error: "Could not update the user."
                  });
                }
              });
            } else {
              callback(400, {
                Error: "The specified user does not exist."
              });
            }
          });
        } else {
          callback(403, {
            Error: "Missing required token in header or token is invalid"
          });
        }
      });
    } else {
      callback(400, {
        Error: "Missing valid strings"
      });
    }
  } else {
    callback(400, {
      Error: "Missing required field."
    });
  }
};

// Requred field : phone
// cleanup & delete any other data files associated with this user.

handlers._users.delete = function (data, callback) {
  // check that the phone number is valid
  const phone =
    typeof data.queryStringObject.phone == "string" &&
    data.queryStringObject.phone.trim().length > 1 ?
    data.queryStringObject.phone.trim() :
    false;
  if (phone) {
    // Get the token from the headers
    const token =
      typeof data.headers.token == "string" ? data.headers.token : false;
    // Verify that the given token from the headers if valid for the phone number
    handlers._tokens.verifyToken(token, phone, function (tokenIsValid) {
      if (tokenIsValid) {
        _data.read("users", phone, function (err, userData) {
          if (!err && data) {
            _data.delete("users", phone, function (err) {
              if (!err) {
                // Delete each of the checks associated with the user.
                const userChecks =
                  typeof userData.checks == "object" &&
                  userData.checks instanceof Array ?
                  userData.checks : [];
                  const checksToDelete = userChecks.length
                  if(checksToDelete > 0) {
                    let checksDeleted = 0
                    let deletionErrors = false
                    // Loop through checks
                    userChecks.forEach(checkId=>{
                      // delete the check
                      _data.delete('checks',checkId,function(err){
                        if(err){
                          deletionErrors = true
                        }
                        checksDeleted++
                        if(checksDeleted == checksToDelete){
                          if(!deletionErrors){
                            callback(200)
                          }
                          else{
                            callback(500,{Error:'Errors encountered while attempting to delete all of the users checks. All checks may not have been deleted from the system successfully.'})
                          }
                        }
                      })
                    })
                  }
                  else {
                    callback(200)
                  }
              } else {
                callback(500, {
                  Error: "Could not delete the specified user."
                });
              }
            });
          } else {
            callback(400, {
              Error: "Could not find the specified user"
            });
          }
        });
      } else {
        callback(403, {
          Error: "Missing required token in header or token is invalid"
        });
      }
    });
  } else {
    callback(400, {
      Error: "Missing Required Field"
    });
  }
};

// Token Handler

handlers.tokens = function (data, callback) {
  const acceptableMethods = ["post", "get", "put", "delete"];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._tokens[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for all the token methods.

handlers._tokens = {};

// Tokens Post
// Required data = phone & password
// optional data : none

handlers._tokens.post = function (data, callback) {
  const phone =
    typeof data.payload.phone == "string" &&
    data.payload.phone.trim().length > 0 ?
    data.payload.phone.trim() :
    false;
  const password =
    typeof data.payload.password == "string" &&
    data.payload.password.trim().length > 0 ?
    data.payload.password.trim() :
    false;

  if (phone && password) {
    // Look up the user who matches that phone number

    _data.read("users", phone, function (err, userData) {
      if (!err && userData) {
        // hash the sent password & compare it to the password stored in the user object.
        const hashedPassword = helpers.hash(password);
        if (hashedPassword == userData.hashedPassword) {
          // If valid create a new token with a random name, set expiration date 1hr in the future.
          const tokenId = helpers.createRandomString(20);
          const expires = Date.now() + 1000 * 60 * 60;
          const tokenObject = {
            phone: phone,
            id: tokenId,
            expires: expires
          };
          _data.create("tokens", tokenId, tokenObject, function (err) {
            if (!err) {
              callback(200, tokenObject);
            } else {
              callback(400, {
                Error: "Could not create a new token."
              });
            }
          });
        } else {
          callback(400, {
            Error: "Password did not match the specified users stored password."
          });
        }
      } else {
        callback(400, {
          Error: "Could not find the specified user."
        });
      }
    });

    // Match the user against the password that was sent.
  } else {
    callback(400, {
      Error: "Missing Required Fields"
    });
  }
};

// Tokens Get
// Required Data : ID
// Optional Data : None
handlers._tokens.get = function (data, callback) {
  // Check that the ID that they sent is valid
  const id =
    typeof data.queryStringObject.id == "string" &&
    data.queryStringObject.id.trim().length == 20 ?
    data.queryStringObject.id.trim() :
    false;
  if (id) {
    _data.read("tokens", id, function (err, tokenData) {
      if (!err && tokenData) {
        callback(200, tokenData);
      } else {
        callback(404);
      }
    });
  } else {
    callback(404);
  }
};

// Tokens Put
// Required Fields : id, extend
// Option Fields : none

handlers._tokens.put = function (data, callback) {
  const id =
    typeof data.payload.id == "string" && data.payload.id.trim().length == 20 ?
    data.payload.id.trim() :
    false;
  const extend =
    typeof data.payload.extend == "boolean" && data.payload.extend == true ?
    data.payload.extend :
    false;
  if (id && extend) {
    _data.read("tokens", id, function (err, tokenData) {
      if (!err && tokenData) {
        // Check to see the token has not expired
        if (tokenData.expires > Date.now()) {
          // Set the expiration an hour from now
          tokenData.expires = Date.now() + 1000 * 60 * 60;
          // Store the new updates to disk
          _data.update("tokens", id, tokenData, function (err) {
            if (!err) {
              callback(200);
            } else {
              callback(500, {
                Error: "Could not update the tokens expiration."
              });
            }
          });
        } else {
          callback(400, {
            Error: "Token has expired."
          });
        }
      } else {
        callback(400, {
          Error: "Token does not exist"
        });
      }
    });
  } else {
    callback(400, {
      Error: "Missing required fields or fields are invalid."
    });
  }
};

// Tokens Delete
// Required Data : ID
// optional Data : none

handlers._tokens.delete = function (data, callback) {
  // Check that id is valid
  var id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if (id) {
    // Lookup the token
    _data.read('tokens', id, function (err, tokenData) {
      if (!err && tokenData) {
        // Delete the token
        _data.delete('tokens', id, function (err) {
          if (!err) {
            callback(200);
          } else {
            callback(500, {
              'Error': 'Could not delete the specified token'
            });
          }
        });
      } else {
        callback(400, {
          'Error': 'Could not find the specified token.'
        });
      }
    });
  } else {
    callback(400, {
      'Error': 'Missing required field'
    })
  }
};

// Checks

handlers.checks = function (data, callback) {
  const acceptableMethods = ["post", "get", "put", "delete"];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._checks[data.method](data, callback);
  } else {
    callback(405);
  }
};

handlers._checks = {};

// Checks POST
// Required data : protocol, url, method, successCodes, timeoutSeconds
// Optional data : none

handlers._checks.post = function (data, callback) {
  // Validate inputs
  const protocol =
    typeof data.payload.protocol == "string" && ["http", "https"].indexOf(data.payload.protocol) > -1 ?
    data.payload.protocol :
    false;
  const url =
    typeof data.payload.url == "string" && data.payload.url.trim().length > 0 ?
    data.payload.url.trim() :
    false;
  const method =
    typeof data.payload.method == "string" && ["post", "get", "delete"].indexOf(data.payload.method) > -1 ?
    data.payload.method :
    false;
  const successCodes =
    typeof data.payload.successCodes == "object" &&
    data.payload.successCodes instanceof Array &&
    data.payload.successCodes.length > 0 ?
    data.payload.successCodes :
    false;

  const timeoutSeconds =
    typeof data.payload.timeoutSeconds == "number" &&
    data.payload.timeoutSeconds % 1 === 0 &&
    data.payload.timeoutSeconds >= 1 &&
    data.payload.timeoutSeconds <= 5 ?
    data.payload.timeoutSeconds :
    false;

  if (protocol && url && method && successCodes && timeoutSeconds) {
    const token =
      typeof data.headers.token == "string" ? data.headers.token : false;

    // Lookup the user from the token

    _data.read("tokens", token, function (err, tokenData) {
      if (!err && tokenData) {
        const userPhone = tokenData.phone;

        //Look up the user data

        _data.read("users", userPhone, function (err, userData) {
          if (!err && userData) {
            const userChecks =
              typeof userData.checks == "object" &&
              userData.checks instanceof Array ?
              userData.checks : [];
            // Verify that the user has less then 5 checks

            if (userChecks.length < config.maxChecks) {
              // Create random ID for the check
              const checkId = helpers.createRandomString(20);
              // Create the check object and include the users' phone
              const checkObject = {
                id: checkId,
                userPhone: userPhone,
                protocol: protocol,
                url: url,
                method: method,
                successCodes: successCodes,
                timeoutSeconds: timeoutSeconds
              };

              // Save to the disk

              _data.create("checks", checkId, checkObject, function (err) {
                if (!err) {
                  // Add the check ID to the users' object
                  userData.checks = userChecks;
                  userData.checks.push(checkId);
                  // Save new user data
                  _data.update("users", userPhone, userData, function (err) {
                    if (!err) {
                      // Return the data about the new check.
                      callback(200, checkObject);
                    } else {
                      callback(500, {
                        Error: "Could not update the user with a new check."
                      });
                    }
                  });
                } else {
                  callback(500, {
                    Error: "Could not create new check."
                  });
                }
              });
            } else {
              callback(400, {
                Error: `The user already has the maximum amount of checks. (${
                  config.maxChecks
                })`
              });
            }
          } else {
            callback(403);
          }
        });
      } else {
        callback(403);
      }
    });
  } else {
    callback(400, {
      Error: "Missing inputs or inputs are invalid."
    });
  }
};

// Checks GET
// Required Data : ID

handlers._checks.get = function (data, callback) {
  // Check that phone number is valid
  const id =
    typeof data.queryStringObject.id == "string" &&
    data.queryStringObject.id.trim().length == 20 ?
    data.queryStringObject.id.trim() :
    false;
  if (id) {
    // Lookup the check
    _data.read("checks", id, function (err, checkData) {
      if ((!err, checkData)) {
        // Get the token from the headers
        const token =
          typeof data.headers.token == "string" ? data.headers.token : false;
        // Verify that the token is valid & belongs to the user who created the check.
        handlers._tokens.verifyToken(token, checkData.userPhone, function (
          tokenIsValid
        ) {
          if (tokenIsValid) {
            // If token is valid return the check data
            callback(200, checkData);
          } else {
            callback(403);
          }
        });
      } else {
        callback(404);
      }
    });
  } else {
    callback(400, {
      Error: "Missing Required Field"
    });
  }
};

// Checks - put
// Required data : id
// Optional data : protocol, url, method, successCode, timeoutSeconds

handlers._checks.put = function (data, callback) {
  const id =
    typeof data.payload.id == "string" && data.payload.id.trim().length == 20 ?
    data.payload.id.trim() :
    false;
  const protocol =
    typeof data.payload.protocol == "string" && ["http", "https"].indexOf(data.payload.protocol) > -1 ?
    data.payload.protocol :
    false;
  const url =
    typeof data.payload.url == "string" && data.payload.url.trim().length > 0 ?
    data.payload.url.trim() :
    false;
  const method =
    typeof data.payload.method == "string" && ["post", "get", "delete"].indexOf(data.payload.method) > -1 ?
    data.payload.method :
    false;
  const successCodes =
    typeof data.payload.successCodes == "object" &&
    data.payload.successCodes instanceof Array &&
    data.payload.successCodes.length > 0 ?
    data.payload.successCodes :
    false;
  const timeoutSeconds =
    typeof data.payload.timeoutSeconds == "number" &&
    data.payload.timeoutSeconds % 1 === 0 &&
    data.payload.timeoutSeconds >= 1 &&
    data.payload.timeoutSeconds <= 5 ?
    data.payload.timeoutSeconds :
    false;

  // Check ID is included
  if (id) {
    // Check at least one optional field has been included
    if (protocol || url || method || timeoutSeconds || successCodes) {
      _data.read("checks", id, function (err, checkData) {
        if (!err && checkData) {
          // Get the token from the headers
          const token =
            typeof data.headers.token == "string" ? data.headers.token : false;
          // Verify that the token is valid & belongs to the user who created the check.
          handlers._tokens.verifyToken(token, checkData.userPhone, function (
            tokenIsValid
          ) {
            if (tokenIsValid) {
              // If token is valid return the check data update the check where necessary.
              if (protocol) {
                checkData.protocol = protocol;
              }
              if (url) {
                checkData.url = url;
              }
              if (method) {
                checkData.method = method;
              }
              if (successCodes) {
                checkData.successCodes = successCodes;
              }
              if (timeoutSeconds) {
                checkData.timeoutSeconds = timeoutSeconds;
              }
              _data.update("checks", id, checkData, function (err) {
                if (!err) {
                  callback(200);
                } else {
                  callback(400, {
                    Error: "Could not update the check."
                  });
                }
              });
            } else {
              callback(403);
            }
          });
        } else {
          callback(400, {
            Error: "Check did not exist."
          });
        }
      });
    } else {
      callback(400, {
        Error: "Missing fields to update."
      });
    }
  } else {
    callback(400, {
      Error: "Missing required fields."
    });
  }
};

// Checks - delete
// Required : id
// Optional : none

// Checks - delete
// Required data: id
// Optional data: none
handlers._checks.delete = function (data, callback) {
  // Check that id is valid
  var id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if (id) {
    // Lookup the check
    _data.read('checks', id, function (err, checkData) {
      if (!err && checkData) {
        // Get the token that sent the request
        var token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
        // Verify that the given token is valid and belongs to the user who created the check
        handlers._tokens.verifyToken(token, checkData.userPhone, function (tokenIsValid) {
          if (tokenIsValid) {

            // Delete the check data
            _data.delete('checks', id, function (err) {
              if (!err) {
                // Lookup the user's object to get all their checks
                _data.read('users', checkData.userPhone, function (err, userData) {
                  if (!err) {
                    var userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];

                    // Remove the deleted check from their list of checks
                    var checkPosition = userChecks.indexOf(id);
                    if (checkPosition > -1) {
                      userChecks.splice(checkPosition, 1);
                      // Re-save the user's data
                      userData.checks = userChecks;
                      _data.update('users', checkData.userPhone, userData, function (err) {
                        if (!err) {
                          callback(200);
                        } else {
                          callback(500, {
                            'Error': 'Could not update the user.'
                          });
                        }
                      });
                    } else {
                      callback(500, {
                        "Error": "Could not find the check on the user's object, so could not remove it."
                      });
                    }
                  } else {
                    callback(500, {
                      "Error": "Could not find the user who created the check, so could not remove the check from the list of checks on their user object."
                    });
                  }
                });
              } else {
                callback(500, {
                  "Error": "Could not delete the check data."
                })
              }
            });
          } else {
            callback(403);
          }
        });
      } else {
        callback(400, {
          "Error": "The check ID specified could not be found"
        });
      }
    });
  } else {
    callback(400, {
      "Error": "Missing valid id"
    });
  }
};

// Verify if a given token ID is currently valid for a given user.

handlers._tokens.verifyToken = function (id, phone, callback) {
  // Look up token
  _data.read("tokens", id, function (err, tokenData) {
    if (!err && tokenData) {
      // Check that the token is for the given user and has not expired.
      if (tokenData.phone == phone && tokenData.expires > Date.now()) {
        callback(true);
      } else {
        callback(false);
      }
    } else {
      callback(false);
    }
  });
};

module.exports = handlers;
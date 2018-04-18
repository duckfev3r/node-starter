/*
 * Library for storing and editing data
 *
 */

// Dependencies

const fs = require("fs");
const path = require("path");
const helpers = require("./helpers");

// Container for the module to be exported

const lib = {};

// Base directory of the data folder.

lib.baseDir = path.join(__dirname, "/../.data/");

lib.create = function (dir, file, data, callback) {
  // Open the file for writing.
  fs.open(`${lib.baseDir}/${dir}/${file}.json`, "wx", function (
    err,
    fileDescriptor
  ) {
    if (!err && fileDescriptor) {
      // Convert data to string.
      const stringData = JSON.stringify(data);
      // Write data to file
      fs.writeFile(fileDescriptor, stringData, function (err) {
        if (!err) {
          fs.close(fileDescriptor, function (err) {
            if (!err) {
              callback(false);
            } else {
              callback("Erorr closing new file");
            }
          });
        } else {
          ("Err writing to new file.");
        }
      });
    } else {
      callback("Could not create new file, it may already exist.");
    }
  });
};

// Read data from file

lib.read = function (dir, file, callback) {
  fs.readFile(lib.baseDir + "/" + dir + "/" + file + ".json", "utf8", function (
    err,
    data
  ) {
    if (!err && data) {
      var parsedData = helpers.parseJsonToObject(data);
      callback(false, parsedData);
    } else {
      callback(err, data);
    }
  });
};

// Update data within a file

lib.update = function (dir, file, data, callback) {
  fs.open(lib.baseDir + "/" + dir + "/" + file + ".json", "r+", function (
    err,
    fileDescriptor
  ) {
    if (!err && fileDescriptor) {
      const stringData = JSON.stringify(data);
      fs.truncate(fileDescriptor, function (err) {
        if (!err) {
          // write to file and close it.
          fs.writeFile(fileDescriptor, stringData, function (err) {
            if (!err) {
              fs.close(fileDescriptor, function (err) {
                if (!err) {
                  callback(false);
                } else {
                  callback("err closing file");
                }
              });
            } else {
              callback("err writing to existing file");
            }
          });
        } else {
          callback("err truncating file");
        }
      });
    } else {
      callback("Could not open file, it may not exist yet.");
    }
  });
};

lib.delete = function (dir, file, callback) {
  // Unlink the file
  fs.unlink(lib.baseDir + "/" + dir + "/" + file + ".json", function (err) {
    if (!err) {
      callback(false);
    } else {
      callback("cannot delete file");
    }
  });
};

// List all the items in a directory.

lib.list = function (dir, callback) {
  fs.readdir(lib.baseDir + dir + '/', function (err, data) {
    if (!err && data && data.length > 0) {
      const trimmedFileNames = []
      data.forEach(function(fileName) {
        trimmedFileNames.push(fileName.replace('.json', ''))
      })
      callback(false,trimmedFileNames)
    }
    else {
      callback(err, data)
    }
  })
}

module.exports = lib;

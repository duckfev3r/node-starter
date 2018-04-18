/*
 * Work Related Tasks
 *
 */

// Dependencies

const path = require('path')
const fs = require('fs')
const _data = require('./data')
const https = require('https')
const http = require('http')
const helpers = require('./helpers')
const url = require('url')
const _logs = require('./logs')
const util = require('util')
const debug = util.debuglog('workers')


// Instantiate the worker Object.

const workers = {}

// Lookup all the checks, get their data, send to validator

workers.gatherAllChecks = function () {
    // Get all the checks that exist in the system
    _data.list('checks', function (err, checks) {
        if (!err && checks && checks.length > 0) {
            checks.forEach(check => {
                _data.read('checks', check, function (err, originalCheckData) {
                    if (!err && originalCheckData) {
                        // Pass the data to the check validator, let that function continue
                        workers.validateCheckData(originalCheckData)
                    }
                    else {
                        debug('Error reading one of the checks data')
                    }
                })
            })
        }
        else {
            debug('Error : Could not find any checks to process')
        }
    })
}

// Sanity Checking the check-data

workers.validateCheckData = function (originalCheckData) {
    originalCheckData = typeof (originalCheckData) == 'object' && originalCheckData !== null ? originalCheckData : {}
    originalCheckData.id = typeof (originalCheckData.id) == 'string' && originalCheckData.id.length == 20 ? originalCheckData.id : false
    originalCheckData.userPhone = typeof (originalCheckData.userPhone) == 'string' && originalCheckData.userPhone.length > 0 ? originalCheckData.userPhone : false
    originalCheckData.protocol = typeof (originalCheckData.protocol) == 'string' && ['http', 'https'].indexOf(originalCheckData.protocol) > -1 ? originalCheckData.protocol : false
    originalCheckData.url = typeof (originalCheckData.url) == 'string' && originalCheckData.url.length > 0 ? originalCheckData.url : false
    originalCheckData.method = typeof (originalCheckData.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(originalCheckData.method) > -1 ? originalCheckData.method : false
    originalCheckData.successCodes = typeof (originalCheckData.successCodes) == 'object' && originalCheckData.successCodes instanceof Array && originalCheckData.successCodes.length > 0 ? originalCheckData.successCodes : false
    originalCheckData.timeoutSeconds = typeof (originalCheckData.timeoutSeconds) == 'number' && originalCheckData.timeoutSeconds % 1 === 0 && originalCheckData.timeoutSeconds >= 1 && originalCheckData.timeoutSeconds <= 5 ? originalCheckData.timeoutSeconds : false

    // Set the keys that may not have been set if the workers have never seen the check before.
    originalCheckData.state = typeof (originalCheckData.state) == 'string' && ['up', 'down'].indexOf(originalCheckData.state) > -1 ? originalCheckData.state : 'down'
    originalCheckData.lastChecked = typeof (originalCheckData.lastChecked) == 'number' && originalCheckData.lastChecked > 0 ? originalCheckData.lastChecked : false

    // If all checks pass, pass the data along to the next step in the process

    if (originalCheckData.userPhone &&
        originalCheckData.protocol &&
        originalCheckData.id &&
        originalCheckData.url &&
        originalCheckData.method &&
        originalCheckData.successCodes &&
        originalCheckData.timeoutSeconds) {
        workers.performCheck(originalCheckData)
    } else {
        debug('Error : one of the checks is not properly formatted.')
    }
}

// Perform the check, send the originalCheckData & the outcome of the check process to the next step.

workers.performCheck = function (originalCheckData) {
    // Prepare the initial check outcome
    const checkOutcome = {
        error: false,
        responseCode: false
    }

    // Mark that the request has not been sent yet.
    let outcomeSent = false

    // Parse the hostname and the path out of the original check data.
    const parsedUrl = url.parse(originalCheckData.protocol + '://' + originalCheckData.url, true)
    const hostname = parsedUrl.hostname
    const path = parsedUrl.path // We are using path & not path-name because we want the full query string.

    // Construct the request
    const requestDetails = {
        protocol: originalCheckData.protocol + ':',
        hostname: hostname,
        method: originalCheckData.method.toUpperCase(),
        path: path,
        timeout: originalCheckData.timeoutSeconds * 1000
    }
    // Instantiate the request object using the http or https module.
    const _moduleToUse = originalCheckData.protocol == 'http' ? http : https

    const req = _moduleToUse.request(requestDetails, function (res) {
        // Grab status of sent request
        const status = res.statusCode

        // Update the check outcome and pass the data along.
        checkOutcome.responseCode = status
        if (!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome)
            outcomeSent = true
        }
    })

    // Bind to the error event doesn't get thrown

    req.on('error', function (e) {
        // Update the check outcome and pass the data along.
        checkOutcome.error = {
            error: true,
            value: e
        }
        if (!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome)
            outcomeSent = true
        }
    })
    // Bind to the timeout event
    req.on('timeout', function (e) {
        // Update the check outcome and pass the data along.
        checkOutcome.error = {
            error: true,
            value: 'timeout'
        }
        if (!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome)
            outcomeSent = true
        }
    })

    // End request

    req.end()
}

// Process the check outcome, update the check data as needed and trigger an alert to the user if needed.
// Include special logic for accomodating a check that has never been tested before. (we don't want to alert on this.)

workers.processCheckOutcome = function (originalCheckData, checkOutcome) {

    // Decide if the check is up or down in it's current state.
    const state = !checkOutcome.error && checkOutcome.responseCode && originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1 ? 'up' : 'down'

    // Decide if an alert is warrented
    const alertWarrented = originalCheckData.lastChecked && originalCheckData.state !== state ? true : false

    const timeOfCheck = Date.now()
    workers.log(originalCheckData, checkOutcome, state, alertWarrented, timeOfCheck)

    // Update the check data
    const newCheckData = originalCheckData
    newCheckData.state = state
    newCheckData.lastChecked = timeOfCheck


    // Save the updates to disk
    _data.update('checks', newCheckData.id, newCheckData, function (err) {
        if (!err) {
            // Send the new check data to the next phase in the process if needed.
            if (alertWarrented) {
                workers.alertUserToStatusChange(newCheckData)
            }
            else {
                debug('Check outcome has not changed, no alert needed.')
            }
        } else {
            debug('trying to save updates to one of the checks')
        }
    })

}

workers.log = function (originalCheckData, checkOutcome, state, alertWarrented, timeOfCheck) {
    // Form the log data
    const logData = {
        check: originalCheckData,
        outcome: checkOutcome,
        state: state,
        alert: alertWarrented,
        time: timeOfCheck
    }

    // Stringify logData
    const logString = JSON.stringify(logData)

    // Determine the name of the log file
    const logFileName = originalCheckData.id

    // Append log string to the file
    _logs.append(logFileName, logString, function (err) {
        if (!err) {
            debug("Logging to file succeeded.")
        }
        else {
            debug("Logging to file failed.")
        }
    })
}

// Alert the user to a change in their check status.

workers.alertUserToStatusChange = function (newCheckData) {
    const message = 'Alert, your check for ' + newCheckData.method.toUpperCase() + ' ' + newCheckData.protocol + '://' + newCheckData.url + ' is currently ' + newCheckData.state
    helpers.sendTwilioSms(newCheckData.userPhone, message, function (err) {
        if (!err) {
            debug('success, user was alerted to a status change in their check via SMS')
            debug(message)
        }
        else {
            debug('Error, could not send SMS to a user who had a state change in their check.')
        }
    })
}

// Rotate aka compress the log files

workers.rotateLogs = function() {
    // List all the non-compressed log files in the .logs folder
    _logs.list(false,function(err,logs){
        if(!err && logs && logs.length>0){
            logs.forEach(function(log){
                // Compress the data to a different file
                const logId = log.replace('.log','')
                const newFileId = logId+'-'+Date.now()
                _logs.compress(logId, newFileId,function(err){
                    if(!err){
                        // Truncate the log
                        _logs.truncate(logId,function(err){
                            if(!err){
                                debug('Success ! Log file truncated.')
                            }
                            else {
                                debug('Error : Could not truncate log file')
                            }
                        })
                    }
                    else {
                        debug('Error compressing one of the log files.')
                    }
                })
            })
        }
        else {
            debug('Error : could not find any logs to rotate')
        }
    })

}

// Timer to execute the log rotation process once per day

workers.logRotationLoop = function(){
    setInterval(x => {
        workers.rotateLogs()
    }, 1000 * 60 * 60 * 24)
}

// Timer to execute the worker process once per minute

workers.loop = function () {
    setInterval(x => {
        workers.gatherAllChecks()
    }, 1000 * 5)
}

// Init Script

workers.init = function () {

    // Send to console, in yellow
    // debug('\x1b[33%s\x1b[0m','Background workers are running')
    console.log('\x1b[33m%s\x1b[0m','Background workers are running');

    // Execute all the checks as soon as this starts up
    workers.gatherAllChecks()

    // Call a loop so the checks continue to execute on their own.
    workers.loop()

    // Compress all logs
    workers.rotateLogs()

    // Call the compression loop so that logs will be compressed later on.
    workers.logRotationLoop()
}




// Exports

module.exports = workers
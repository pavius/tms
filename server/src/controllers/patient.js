var async = require('async');
var libphonenumber = require('libphonenumber');
var httpRequest = require('request');
var querystring = require('querystring');
var Patient = require('../models/patient');
var Appointment = require('../models/appointment');
var moment = require('moment');
var momentTz = require('moment-timezone');

var controller =
{
    init: function(app)
    {
        this.app = app;

        // re-evaluate patients now
        this.reevaluatePatients();
        this.sendAppointmentReminders();

        // periodically re-evaluate as well
        setInterval(this.reevaluatePatients, 60 * 1000);
        setInterval(this.sendAppointmentReminders, 60 * 1000);
    },

    reevaluatePatients: function(done)
    {
        Patient.find({'appointments.payment': null}, function(error, patientsFromDb)
        {
            if (error)
            {
                console.log("Error reevaluating patients: " + error);
                return;
            }

            var patientsNeedingUpdate = [];

            // iterate over patients, look for those whose debt is incorrect
            patientsFromDb.forEach(function(patient)
            {
                correctDebt = patient.calculateDebt();

                // the only reason that the debt should be re-calculated is if an appointment's datetime has passed.
                // all modifications to appointments automatically update the debt for the patient.
                if (correctDebt.total != patient.debt.total)
                {
                    console.log("Updating debt for " + patient.name + " from " + patient.debt.total + " to " + correctDebt.total);

                    // set updated debt
                    patient.debt = correctDebt;
                    patientsNeedingUpdate.push(patient);
                }
            });

            // update all patients needing update
            if (patientsNeedingUpdate.length)
            {
                async.forEach(patientsNeedingUpdate, function(patient, callback)
                {
                    // save patient
                    patient.save(callback);

                }, done);
            }
            else
            {
                if (done) done();
            }
        });
    },

    sendAppointmentReminders: function(done)
    {
        function generateReminderText(appointment)
        {
            try
            {
                var mtz = moment(appointment.when).tz('Asia/Jerusalem');

                var when = 'ב-' +
                    mtz.format('DD/MM') +
                    ' בשעה ' +
                    mtz.format('HH:mm');
            }
            catch(e)
            {
                console.log(e);
            }

            if (appointment.type == 'skype')
                return 'תזכורת: פגישת סקייפ עם טל קפלינסקי ' + when;
            else
                return 'תזכורת: פגישה עם טל קפלינסקי ' + when + '. בן סרוק 20 תל אביב - מרפאת רזולוציה';
        }

        var next24HoursFilter = {'$gte': new Date(), '$lte': new Date(Date.now() + 24 * 60 * 60 * 1000)};

        var aggregateQuery =  [
            // match only patients with an appointment in the next 24 hours
            {'$match':
            {
                'primaryPhone': {'$nin': [null, ""]},
                'appointments.when': next24HoursFilter,
                'appointmentReminders': {'$nin': [null, "none"]}
            }
            },

            // remove all unnecessary fields from patient
            {'$project': {'_id': 1, 'appointments': 1, 'name': 1, 'email': 1, 'primaryPhone': 1}},

            // treat appointments subdoc as a document so that we can match on it
            {'$unwind': '$appointments'},

            // take only appointments within next 24 hours
            {'$match': {'appointments.when': next24HoursFilter, 'appointments.reminderSent': {'$in': [null, false]}}}
        ];

        Patient.aggregate(aggregateQuery, function(error, patients)
        {
            if (!error && patients)
            {
                /* _.forEach(patients, function(patient) */
                for (var idx = 0; idx < patients.length; ++idx)
                {
                    var patient = patients[idx];
                    console.log(patient.name)

                    try
                    {
                        var phoneNumber = libphonenumber.e164(patient.primaryPhone, 'IL');

                        if (phoneNumber)
                        {
                            console.log('Sending reminder SMS to ' + patient.name + phoneNumber);

                            var params = {
                                'api_key': process.env.NEXMO_API_KEY,
                                'api_secret': process.env.NEXMO_API_SECRET,
                                'from': '972543020641',
                                'to': phoneNumber,
                                'text': generateReminderText(patient.appointments),
                                'type': 'unicode'
                            };

                            httpRequest(
                                {
                                    'method': 'POST',
                                    'url': 'https://rest.nexmo.com/sms/json?' + querystring.stringify(params),
                                    'headers': {'charset': 'utf-8'}
                                },
                                function (error, response, body)
                                {
                                    console.log("Raw response from Nexmo:\n" + body);
                                    body = JSON.parse(body);

                                    if (!error && body.messages[0].status == 0)
                                    {
                                        console.log("SMS sent successfully");

                                        Patient.findById(patient._id, function(error, patientToUpdate)
                                        {
                                            if (error)
                                                console.log("Error saving patient: " + error);

                                            patientToUpdate.appointments.id(patient.appointments._id).reminderSent = true;
                                            patientToUpdate.save();
                                        });
                                    }
                                    else
                                    {
                                        console.error("Failed to send SMS (error: " + error + ")");
                                    }
                                }
                            );
                        }
                    }
                    catch(e)
                    {
                        // skip patients with invalid phone number
                        console.error(patient.name + " has an invalid phone number: " + patient.primaryPhone);
                    }
                }
            }
            else
            {
                console.log("Error aggregating: " + error);
                console.log("Patients: " + patients);
            }
        });
    }
};

module.exports = controller;

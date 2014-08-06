var async = require('async');
var Patient = require('../models/patient');

var controller =
{
    init: function(app)
    {
        this.app = app;

        // re-evaluate patients now
        this.reevaluatePatients();

        // periodically re-evaluate as well
        setInterval(this.reevaluatePatients, 60 * 1000);
    },

    reevaluatePatients: function(done)
    {
        Patient.find({'appointments.payment': null}, function(error, patientsFromDb)
        {
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
    }
};

module.exports = controller;

var request = require('supertest');
var expect = require('chai').expect;
var async = require('async');
var common = require('./common');
var app = require('../src/server');
var Patient = require('../src/models/patient');
var Appointment = require('../src/models/appointment');

describe('Appointments', function() 
{
    var patientFixtures = [];
    var fixtures = [];

    beforeEach(function(done)
    {
        patientFixtures =
        [
            {
                name: "1_name",
                primaryPhone: "+972546653001",
                email: "1@here.com",
                appointments:
                [
                    {
                        when: (new Date()).toISOString(),
                        summary: "The guy is a cunt.",
                        summarySent: false,
                        missed: false
                    },

                    {
                        when: (new Date()).toISOString(),
                        summary: "No hope for this one.",
                        summarySent: true,
                        missed: false,
                        price: 600
                    }
                ]
            },

            {
                name: "2_name",
                primaryPhone: "+972546653002",
                email: "2@here.com",
                appointmentPrice: 500
            },
        ];

        // drop everything
        common.dropCollections(['patients', 'appointments', 'payments'], function(err)
        {
            async.each(patientFixtures, function(patientFixture, doneWithPatient)
            {
                // create the patient
                Patient.create(patientFixture, doneWithPatient);
            },
            done);
        });
    });

    describe('GET /api/appointments', function() 
    {
        it('should return all appointments', function(done)
        {
            console.log("foo");
            done();
        });
    });
});
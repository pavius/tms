// This is test/app.js
var request = require('supertest');
var expect = require('chai').expect;
var async = require('async');
var app = require('../src/server');
var common = require('./common');

var Patient = require('../src/models/patient');
var Appointment = require('../src/models/appointment');
var Payment = require('../src/models/payment');

/*
 * Test patients API
 */
describe('Patients', function() 
{
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

        // inject test fixtures
        common.injectFixtures(patientFixtures, done);
    });

    describe('GET /api/patients', function() 
    {
        it('should return all patients without appointments/payments', function(done)
        {
            common.getAllAndCompareToFixtures(app, 
                                              'patients', 
                                              "select=-appointments -payments", 
                                              Patient, 
                                              patientFixtures, 
                                              {'appointments': {'mode': 'skip'}, 'payments': {'mode': 'skip'},}, 
                                              done);
        });
    });

    describe('GET /api/patients/<id>', function()
    {
        describe('when requesting a patient with a valid id', function() 
        {
            it('should return a single patient', function(done)
            {
                common.getOneAndCompareToFixture(app, 
                                                 'patients',
                                                 "select=-appointments -payments",
                                                 Patient, 
                                                 patientFixtures[0], 
                                                 {'appointments': {'mode': 'mustntExist'}, 'payments': {'mode': 'mustntExist'},}, 
                                                 done);
            });
        });

        describe('when requesting a patient with a valid id, and requesting its appointments', function() 
        {
            it('should return a single patient with all its appointments', function(done)
            {
                common.getOneAndCompareToFixture(app, 
                                                 'patients',
                                                 null,
                                                 Patient, 
                                                 patientFixtures[0], 
                                                 null, 
                                                 done);
            });
        });

        describe('when requesting a patient whose fixture omits a value which should be received as a default', function() 
        {
            it('should return a single patient', function(done)
            {
                request(app)
                .get('/api/patients/' + patientFixtures[0]._id)
                .end(function(err, response)
                {
                    if (err) return done(err);

                    // verify the response has a default price
                    expect(response.body.appointmentPrice).to.equal(330);

                    done();
                });
            });
        });

        describe('when requesting a patient with an invalid id', function() 
        {
            it('should return 404', function(done)
            {
                common.getInvalidOneAndVerifyNotFound(app, 'patients', Patient, done);
            });
        });
    });

    describe('POST /api/patients', function() 
    {
        describe('when creating a new resource /patients', function() 
        {
            it('should respond with 201 and create an object', function(done) 
            {
                var newPatient = 
                {
                    name: 'New patient',
                    primaryPhone: "+972546653003",
                    email: 'new@guy.com'
                };

                common.postNewAndVerifyCreation(app, 'patients', Patient, newPatient, null, function(err, response)
                {
                    done(err);
                });
            });
        });
    });

    describe('PUT /api/patients', function() 
    {
        describe('when updating a resource /patients', function() 
        {
            it('should respond with 204 and update the object', function(done) 
            {
                var updatedPatient = 
                {
                    name: 'Updated patient',
                    primaryPhone: "+972546653004",
                    email: 'updated@mail.com'
                };

                common.updateAndVerifyUpdate(app, 'patients', Patient, patientFixtures[0], updatedPatient, null, done);
            });
        });
    });

    describe('DELETE /api/patients/:id', function() 
    {
        describe('when deleting an existing patient', function() 
        {
            it('should respond with 204', function(done) 
            {
                common.deleteExistingAndVerifyRemaining(app, 'patients', Patient, patientFixtures[0]._id, patientFixtures.length, done);
            });
        });

        describe('when deleting an inexistent patient', function() 
        {
            it('should respond with 404', function(done)
            {
                common.deleteNoneExistingAndVerifyResponse(app, 'patients', Patient, done);
            });
        });
    });

    describe.skip('Patient status', function() 
    {
        describe('when adding/removing appointments', function() 
        {
            it('should update the patient status accordingly', function(done) 
            {
                function buildAppointmentSchema(patientId, expectedStatus)
                {
                    // describe what to expect as the patient member, since patient in the fixture
                    // is an ID. the response will replace it with the patient info
                    return {
                        patient:
                        {
                            expect:
                            {
                                _id: patientId,
                                status: expectedStatus
                            }
                        }
                    };
                }

                function createAppointmentCheckStatus(patientId, date, expectedStatus, callback)
                {
                    var newAppointment = 
                    {
                        summary: "...",
                        patient: patientId,
                        when: date
                    };

                    common.postNewAndVerifyCreation(app, 'appointments', Appointment, newAppointment, 
                                                    buildAppointmentSchema(patientId, expectedStatus), 
                                                    function(err, response)
                    {
                        // save appointment id
                        appointments.push(response._id);
                        expect(response.patient.status).to.equal(expectedStatus);
                        callback();
                    });
                }

                function deleteAppointmentCheckStatus(patientId, appointmentIndex, expectedStatus, callback)
                {
                    common.deleteExistingAndVerifyResponse(app, 'appointments', Appointment, appointments[appointmentIndex],
                                                           null, null,
                                                           function(err, response)
                    {
                        // verify patient's status
                        console.log(response);
                        expect(response.patient.status).to.equal(expectedStatus);
                        callback();
                    });
                }

                var newPatient = 
                {
                    name: 'New patient',
                    primaryPhone: "+972546653003",
                    email: 'new@guy.com'
                };

                var appointments = [];

                async.series(
                [
                    function(callback)
                    {
                        // create a patient
                        common.postNewAndVerifyCreation(app, 'patients', Patient, newPatient, null, function(err, response)
                        {
                            newPatient._id = response._id;
                            expect(response.status).to.equal('new');
                            callback();
                        });
                    },

                    function(callback)
                    {
                        createAppointmentCheckStatus(newPatient._id, (new Date()).toISOString(), 'new', callback);
                    },

                    function(callback)
                    {
                        createAppointmentCheckStatus(newPatient._id, (new Date()).toISOString(), 'active', callback);
                    },

                    function(callback)
                    {
                        deleteAppointmentCheckStatus(newPatient._id, 0, 'active', done);
                    },
                ]);
            });
        });
    });
});

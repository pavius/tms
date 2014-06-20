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
                    expect(response.body.appointmentPrice).to.equal(350);

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
});

describe('Patient status', function()
{
    var weekInMs = 7 * 24 * 60 * 60 * 1000;

    // create an appointment for a patient, verify patient status on response
    function createAppointment(patientId, when, expectedStatus, cb)
    {
        request(app)
            .post('/api/patients/' + patientId + '/appointments')
            .send({when: when})
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, response)
            {
                if (err) cb(err);
                else
                {
                    expect(response.body.status).to.equal(expectedStatus);

                    // save appointment id
                    appointments.push(response.body.appointments[0]._id);

                    cb();
                }
            });
    }

    // update an appointment for a patient, verify patient status on response
    function updateAppointment(patientId, appointmentId, when, expectedStatus, cb)
    {
        request(app)
            .put('/api/patients/' + patientId + '/appointments/' + appointmentId)
            .send({when: when})
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, response)
            {
                if (err) cb(err);
                else
                {
                    expect(response.body.status).to.equal(expectedStatus);

                    cb();
                }
            });
    }

    // create an appointment for a patient, verify patient status on response
    function deleteAppointment(patientId, appointmentId, expectedStatus, cb)
    {
        request(app)
            .delete('/api/patients/' + patientId + '/appointments/' + appointmentId)
            .expect(200)
            .end(function(err, response)
            {
                if (err) cb(err);
                else
                {
                    expect(response.body.status).to.equal(expectedStatus);

                    // remove id from appointments
                    appointments.splice(appointments.indexOf(appointmentId), 1);
                    cb();
                }
            });
    }

    function generateTimeFromNow(days, hours, minutes)
    {
        var now = Date.now();
        now += days * ((24 * 60 * 60 * 1000));
        now += hours * ((60 * 60 * 1000));
        now += minutes * ((60 * 1000));

        return new Date(now);
    }

    beforeEach(function(done)
    {
        patientId = null;
        appointments = [];

        // create a patient
        request(app)
            .post('/api/patients')
            .send({name: 'n', email: 'n@h.com'})
            .expect(201)
            .end(function(err, response)
            {
                if (err) return done(err);

                expect(response.body.status).to.equal('new');
                patientId = response.body._id;
                done();
            });
    });

    describe('when a patient has more than N appointments', function()
    {
        it('should transition from new to active', function(done)
        {
            var appointmentIndex = 0;

            // create 7 appointments - must be new
            async.whilst(
                function() { return appointmentIndex < 7 },

                // 7 appointments - must be new
                function(callback)
                {
                    createAppointment(patientId, (new Date()).toISOString(), 'new', callback);
                    appointmentIndex++;
                },

                // 8th appointment - become active
                function()
                {
                    createAppointment(patientId, (new Date()).toISOString(), 'active', done);
                });
        });
    });

    describe('when a patient has only 2 appointments but was previously active', function()
    {
        it('should remain active, and not become new again', function(done)
        {
            // do appointment stuff one at a time
            async.series(
                [
                    // create an appointment 3 weeks from now, should lose "new" status
                    function(callback)
                    {
                        createAppointment(patientId, generateTimeFromNow(-21, 0, 0).toISOString(), 'active', callback);
                    },

                    // another appointment from now - should not regain "new" status
                    function(callback)
                    {
                        createAppointment(patientId, (new Date()).toISOString(), 'active', done);
                    }
                ]);
        });
    });

    describe('when a patient becomes inactive and then an appointment is created', function()
    {
        it('should become active', function(done)
        {
            // do appointment stuff one at a time
            async.series(
                [
                    // create an appointment 3 weeks from now, should lose "new" status
                    function(callback)
                    {
                        createAppointment(patientId, generateTimeFromNow(-80, 0, 0).toISOString(), 'inactive', callback);
                    },

                    // another appointment from now - should not regain "new" status
                    function(callback)
                    {
                        createAppointment(patientId, (new Date()).toISOString(), 'active', done);
                    }
                ]);
        });
    });

    describe('when a patient is inactive, changes are made to appointments and status is recalculated', function()
    {
        it('should update status according to as if it were just created', function(done)
        {
            // do appointment stuff one at a time
            async.series(
                [
                    // create an appointment 3 weeks from now, should lose "new" status
                    function(callback)
                    {
                        createAppointment(patientId, generateTimeFromNow(-80, 0, 0).toISOString(), 'inactive', callback);
                    },

                    // update the appointment to "now" - it should become active but not new
                    function(callback)
                    {
                        updateAppointment(patientId, appointments[0]._id, (new Date()).toISOString(), 'active', callback);
                    },

                    // now recalculate the status of the patient
                    function(callback)
                    {
                        // create a patient
                        request(app)
                            .put('/api/patients/' + patientId)
                            .send({manualStatus: 'recalculate'})
                            .expect(200)
                            .end(function(err, response)
                            {
                                if (err) return done(err);
                                expect(response.body.status).to.equal('new');
                                done();
                            });
                    }
                ]);
        });
    });
});
var request = require('supertest');
var expect = require('chai').expect;
var assert = require('chai').assert;
var async = require('async');
var nock = require('nock');
var url = require('url');
var common = require('./common');
var app = require('../src/server');
var Patient = require('../src/models/patient');
var Payment = require('../src/models/payment');

describe('Payments', function()
{
    var patientFixtures = [];
    var fixtures = [];

    function callInvoiceCompleteWebhook(patient, payment, callback)
    {
        var invoice = {url: 'http://www.gi.com/link', id: '00fad0c7-0b47-c1b4-b900-64fbaba1cd6d'};

        request(app)
            .post('/api/patients/' + patient._id + '/payments/' + payment._id + '/invoices')
            .type('form')
            .send({ticket_id: payment.invoice.ticket})
            .send({url: invoice.url})
            .send({id: invoice.id})
            .expect(200)
            .end(function(err, response)
            {
                if (err) return callback(err);

                // verify that payment was updated with invoice info
                request(app)
                    .get('/api/patients/' + patient._id + '/payments/' + payment._id)
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function(err, response)
                    {
                        if (err) return callback(err);
                        expect(response.body.invoice.id).to.equal(invoice.id);
                        expect(response.body.invoice.url).to.equal(invoice.url);
                        callback();
                    });
            });
    }

    function formatDateForGreenInvoice(date)
    {
        if (!(date instanceof Date))
            date = new Date(date);

        var yyyy = date.getFullYear().toString();
        var mm = (date.getMonth() + 1).toString();
        var dd  = date.getDate().toString();

        return yyyy + '-' + (mm[1] ? mm : "0" + mm[0]) + '-' + (dd[1] ? dd : "0" + dd[0]);
    }

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
                            summary: "More",
                            summarySent: false
                        }
                    ],
                    payments:
                    [
                        {
                            when: (new Date()).toISOString(),
                            sum: 1000
                        },
                        {
                            when: (new Date()).toISOString(),
                            sum: 1500
                        }
                    ]
                },

                {
                    name: "2_name",
                    primaryPhone: "+972546653002",
                    email: "2@here.com",
                    appointmentPrice: 500,
                    appointments:
                        [
                            {
                                when: (new Date(2010, 1, 1)).toISOString(),
                                price: 500
                            },

                            {
                                when: (new Date(2011, 1, 1)).toISOString(),
                                price: 250
                            },

                            {
                                when: (new Date(2012, 1, 1)).toISOString(),
                                price: 275
                            },
                        ]
                }
            ];

        // inject test fixtures
        common.injectFixtures(patientFixtures, done);

        nock.cleanAll();
    });

    describe('GET /api/patients/x/payments', function()
    {
        it('should return all payments for patient x', function(done)
        {
            request(app)
                .get('/api/patients/' + patientFixtures[0]._id + '/payments')
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, response)
                {
                    if (err) return done(err);
                    common.compareFixturesToResponse(patientFixtures[0].payments, response.body, null);
                    done();
                });
        });
    });

    describe('POST /api/patients/x/payments', function()
    {
        // the gi API encodes JSON as form data. we need to decode it and return the object
        function getGreenInvoiceDataFromRequest(requestBody)
        {
            return JSON.parse(url.parse('?' + decodeURIComponent(requestBody), true).query.data);
        }

        describe('when creating a new payment for a patient that wholly covers appointments', function()
        {
            it('should respond with 201, patient info and create an object', function(done)
            {
                var newPayment =
                {
                    when: (new Date()).toISOString(),
                    sum: 750,
                    transaction: {type: 'cash'}
                };

                patient = patientFixtures[1];

                // unless specified otherwise, mock all requests towards greeninvoice by returning success
                nock('https://api.greeninvoice.co.il')
                    .post('/api/documents/add')
                    .reply(200, function(uri, requestBody)
                    {
                        return {'error_code': 0, data: {ticket: '8cdd2b30-417d-d994-a924-7ea690d0b9a3'}};
                    });

                request(app)
                    .post('/api/patients/' + patient._id + '/payments')
                    .send(newPayment)
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, response)
                    {
                        if (err) return done(err, null);

                        // expect the debt to equal the cost of the third appointment
                        patient.debt =
                        {
                            total: patient.appointments[2].price,
                            oldestNonPaidAppointment: patient.appointments[2].when
                        }

                        // expect patient + first two appointments (to which it attached to)
                        patient.payments = [newPayment];
                        patient.appointments = [patient.appointments[0], patient.appointments[1]];

                        // did we get it as a response?
                        common.compareFixtureToResponse(patient, response.body, null);

                        done();
                    });
            });
        });

        describe('when creating a new payment for a patient that doesnt wholly cover appointments', function()
        {
            it('should respond with 403', function(done)
            {
                var newPayment =
                {
                    when: (new Date()).toISOString(),
                    sum: 745,
                    transaction: {type: 'cash'}
                };

                patient = patientFixtures[1];

                request(app)
                    .post('/api/patients/' + patient._id + '/payments')
                    .send(newPayment)
                    .expect('Content-Type', /json/)
                    .expect(403)
                    .end(done);
            });
        });

        describe('when creating a new payment for a patient that with a sum too large', function()
        {
            it('should respond with 403', function(done)
            {
                var newPayment =
                {
                    when: (new Date()).toISOString(),
                    sum: 5000,
                    transaction: {type: 'cash'}
                };

                patient = patientFixtures[1];

                request(app)
                    .post('/api/patients/' + patient._id + '/payments')
                    .send(newPayment)
                    .expect('Content-Type', /json/)
                    .expect(403)
                    .end(done);
            });
        });

        describe('when creating a payment with cash', function()
        {
            it('should call the GI API with correct settings', function(done)
            {
                var newPayment =
                {
                    when: (new Date()).toISOString(),
                    sum: 750,
                    transaction: {type: 'cash', invoiceRecipient: 'Some guy'}
                };

                patient = patientFixtures[1];

                // expect invoice and check all parameters, including cash
                nock('https://api.greeninvoice.co.il')
                    .post('/api/documents/add')
                    .reply(200, function(uri, requestBody)
                    {
                        invoice = getGreenInvoiceDataFromRequest(requestBody);
                        expect(invoice.params.doc_type).to.equal(320);
                        expect(invoice.params.client.name).to.equal(newPayment.transaction.invoiceRecipient);
                        expect(invoice.params.income[0].price).to.equal(newPayment.sum);
                        expect(invoice.params.income[0].description).to.equal('אימון');
                        expect(invoice.params.payment[0].type).to.equal(1);
                        expect(invoice.params.payment[0].amount).to.equal(newPayment.sum);

                        return {'error_code': 0, data: {ticket: '8cdd2b30-417d-d994-a924-7ea690d0b9a3'}};
                    });

                request(app)
                    .post('/api/patients/' + patient._id + '/payments')
                    .send(newPayment)
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, response)
                    {
                        callInvoiceCompleteWebhook(patient, response.body.payments[0], function(err, response)
                        {
                            // verify that payment was updated with invoice info
                            request(app)
                                .get('/api/patients/' + patient._id)
                                .expect('Content-Type', /json/)
                                .expect(200)
                                .end(function(err, response)
                                {
                                    expect(response.body.invoiceRecipient).to.equal(newPayment.transaction.invoiceRecipient);
                                    done(err);
                                });
                        });
                    });
            });
        });

        describe('when creating a payment with cash but without invoice', function()
        {
            it('should not call the GI API', function(done)
            {
                var newPayment =
                {
                    when: (new Date()).toISOString(),
                    sum: 750,
                    transaction: {type: 'cash', invoiceRecipient: 'Some guy', issueInvoice: false}
                };

                patient = patientFixtures[1];

                // expect invoice and check all parameters, including cash
                nock('https://api.greeninvoice.co.il')
                    .post('/api/documents/add')
                    .reply(200, function(uri, requestBody)
                    {
                        assert.fail('', '', 'Should not get here');
                    });

                request(app)
                    .post('/api/patients/' + patient._id + '/payments')
                    .send(newPayment)
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, response)
                    {
                        done();
                    });
            });
        });

        describe('when creating a payment with cheque', function()
        {
            it('should call the GI API with correct settings and update patient bank info', function(done)
            {
                var newPayment =
                {
                    when: new Date(),
                    sum: 750,
                    emailInvoice: true,
                    transaction:
                    {
                        type: 'cheque',
                        issueInvoice: true,
                        cheque:
                        {
                            number: 123,
                            date: new Date(),
                            bank:
                            {
                                name: 'Whatever bank',
                                branch: 'Some branch',
                                account: 'Foo account'
                            }
                        }
                    }
                };

                patient = patientFixtures[1];

                // expect invoice and check all parameters, including cash
                nock('https://api.greeninvoice.co.il')
                    .post('/api/documents/add')
                    .reply(200, function(uri, requestBody)
                    {
                        invoice = getGreenInvoiceDataFromRequest(requestBody);
                        expect(invoice.params.doc_type).to.equal(320);
                        expect(invoice.params.client.name).to.equal(patient.name);
                        expect(invoice.params.client.send_email).to.equal(newPayment.emailInvoice);
                        expect(invoice.params.income[0].price).to.equal(newPayment.sum);
                        expect(invoice.params.income[0].description).to.equal('אימון');
                        expect(invoice.params.payment[0].type).to.equal(2);
                        expect(invoice.params.payment[0].amount).to.equal(newPayment.sum);
                        expect(invoice.params.payment[0].bank).to.equal(newPayment.transaction.cheque.bank.name);
                        expect(invoice.params.payment[0].branch).to.equal(newPayment.transaction.cheque.bank.branch);
                        expect(invoice.params.payment[0].account).to.equal(newPayment.transaction.cheque.bank.account);
                        assert.equal(invoice.params.payment[0].number, newPayment.transaction.cheque.number);
                        expect(invoice.params.payment[0].date).to.equal(formatDateForGreenInvoice(newPayment.transaction.cheque.date));

                        return {'error_code': 0, data: {ticket: '8cdd2b30-417d-d994-a924-7ea690d0b9a3'}};
                    });

                request(app)
                    .post('/api/patients/' + patient._id + '/payments')
                    .send(newPayment)
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, response)
                    {
                        // call webhook and on completion, check that patient has updated bank details
                        callInvoiceCompleteWebhook(patient, response.body.payments[0], function(err, response)
                        {
                            // verify that payment was updated with invoice info
                            request(app)
                                .get('/api/patients/' + patient._id)
                                .expect('Content-Type', /json/)
                                .expect(200)
                                .end(function(err, response)
                                {
                                    expect(response.body.bank.name).to.equal(newPayment.transaction.cheque.bank.name);
                                    expect(response.body.bank.branch).to.equal(newPayment.transaction.cheque.bank.branch);
                                    expect(response.body.bank.account).to.equal(newPayment.transaction.cheque.bank.account);
                                    done(err);
                                });
                        });
                    });
            });
        });

        describe('when creating a payment with transfer', function()
        {
            it('should call the GI API with correct settings and update patient bank info', function(done)
            {
                var newPayment =
                {
                    when: new Date(),
                    sum: 750,
                    emailInvoice: false,
                    transaction:
                    {
                        type: 'transfer',
                        transfer:
                        {
                            date: new Date(),
                            bank:
                            {
                                name: 'Whatever bank',
                                branch: 'Some branch',
                                account: 'Foo account'
                            }
                        }
                    }
                };

                patient = patientFixtures[1];

                // expect invoice and check all parameters, including cash
                nock('https://api.greeninvoice.co.il')
                    .post('/api/documents/add')
                    .reply(200, function(uri, requestBody)
                    {
                        invoice = getGreenInvoiceDataFromRequest(requestBody);
                        expect(invoice.params.doc_type).to.equal(320);
                        expect(invoice.params.client.name).to.equal(patient.name);
                        expect(invoice.params.client.send_email).to.equal(newPayment.emailInvoice);
                        expect(invoice.params.income[0].price).to.equal(newPayment.sum);
                        expect(invoice.params.income[0].description).to.equal('אימון');
                        expect(invoice.params.payment[0].type).to.equal(4);
                        expect(invoice.params.payment[0].amount).to.equal(newPayment.sum);
                        expect(invoice.params.payment[0].bank).to.equal(newPayment.transaction.transfer.bank.name);
                        expect(invoice.params.payment[0].branch).to.equal(newPayment.transaction.transfer.bank.branch);
                        expect(invoice.params.payment[0].account).to.equal(newPayment.transaction.transfer.bank.account);
                        expect(invoice.params.payment[0].date).to.equal(formatDateForGreenInvoice(newPayment.transaction.transfer.date));

                        return {'error_code': 0, data: {ticket: '8cdd2b30-417d-d994-a924-7ea690d0b9a3'}};
                    });

                request(app)
                    .post('/api/patients/' + patient._id + '/payments')
                    .send(newPayment)
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, response)
                    {
                        // call webhook and on completion, check that patient has updated bank details
                        callInvoiceCompleteWebhook(patient, response.body.payments[0], function(err, response)
                        {
                            // verify that payment was updated with invoice info
                            request(app)
                                .get('/api/patients/' + patient._id)
                                .expect('Content-Type', /json/)
                                .expect(200)
                                .end(function(err, response)
                                {
                                    expect(response.body.bank.name).to.equal(newPayment.transaction.transfer.bank.name);
                                    expect(response.body.bank.branch).to.equal(newPayment.transaction.transfer.bank.branch);
                                    expect(response.body.bank.account).to.equal(newPayment.transaction.transfer.bank.account);
                                    done(err);
                                });
                        });
                    });
            });
        });
    });

    describe('PUT /api/patients/x/payments', function()
    {
        describe('when updating an payment for a patient', function()
        {
            it('should respond with 200, patient info and updated object', function(done)
            {
                patientFixtures[0].payments[0].when = (new Date()).toISOString();

                request(app)
                    .put('/api/patients/' + patientFixtures[0]._id + '/payments/' + patientFixtures[0].payments[0]._id)
                    .send(patientFixtures[0].payments[0])
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function(err, response)
                    {
                        if (err) return done(err, null);

                        // expect only 1 payment
                        patientFixtures[0].payments = [patientFixtures[0].payments[0]];

                        // did we get it as a response?
                        common.compareFixtureToResponse(patientFixtures[0], response.body, null);

                        done();
                    });
            });
        });
    });

    describe('DELETE /api/patients/x/payments', function()
    {
        describe('when deleting an payment for a patient', function()
        {
            it('should respond with 200, patient info', function(done)
            {
                request(app)
                    .delete('/api/patients/' + patientFixtures[0]._id + '/payments/' + patientFixtures[0].payments[0]._id)
                    .send()
                    .expect(200)
                    .end(function(err, response)
                    {
                        if (err) return done(err, null);

                        // did we get it as a response?
                        delete patientFixtures[0].payments;
                        common.compareFixtureToResponse(patientFixtures[0], response.body, null);

                        done();
                    });
            });
        });
    });
});
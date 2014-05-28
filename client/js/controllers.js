/* Controllers */
angular.module('tms.controllers', 
[
    'ui.bootstrap',
    'ui.bootstrap.tpls'
]);

var navController = function($scope, $location)
{
    $scope.isActive = function (viewLocation) 
    {
        var path = $location.path();

        // look for perfect match
        if (viewLocation === path)
        {
            return true;
        }
        // look for imperfect match for non-root
        else if (viewLocation != '/')
        {
            return path.substring(0, viewLocation.length) === viewLocation;
        }
        else return false;
    };    
};

var dashboardController = function($scope, $location, Appointment) 
{
    function getPatientsRequiringSummary(callback)
    {
        resultList = {};

        Appointment.query({
                              'when': '{lte}' + Date.now(), 
                              'summary_sent': false, 
                              'missed': false, 
                              'populate_patient': true
                          }, 
        function(appointments)
        {
            appointments.forEach(function(appointment)
            {
                patient = appointment.patient;

                // was this patient already added?
                if (!resultList.hasOwnProperty(patient._id))
                {
                    resultList[patient._id] = {name: patient.name, appointments: 1};
                }
                else
                {
                    // add to # of appointments
                    resultList[appointment.patient._id].appointments++;
                }
            });

            // done
            callback(resultList);
        });
    }

    function getAppointmentsComingUp(callback)
    {
        cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() + 7);

        Appointment.query({
                              'when': '{gte}' + Date.now() + '{lte}' + cutoffDate.getTime(), 
                              'populate_patient': true
                          }, 
        function(appointments)
        {
            // done
            callback(appointments);
        });
    }

    $scope.patientsWithUnsummarizedAppointments = {};
    $scope.appointmentsComingUp = [];
    
    // build todo list
    getPatientsRequiringSummary(function(results)
    {
        $scope.patientsWithUnsummarizedAppointments = results;
    });

    // get upcoming appointments
    getAppointmentsComingUp(function(results)
    {
        $scope.appointmentsComingUp = results;
    });
};
    
var patientsController = function($scope, $log, $location, $modal, Patient) 
{
    $scope.searchTerm = '';

    // pagination
    $scope.patients = [];

    // get all patients
    Patient.query(function(patients)
    {
        $scope.patients = patients;
    });
    
    // create a new patient
    $scope.create = function()
    {
        patientModal = $modal.open({templateUrl: './partials/new_patient',
                                    controller: patientModalController});

        patientModal.result.then(function(newPatient)
        {
            Patient.save(newPatient, function(dbObject)
            {
                // shove to view
                $scope.patients.push(dbObject);
            });
        });
    };

    $scope.searchFilter = function(patient) 
    {
        var keyword = new RegExp($scope.searchTerm, 'i');
        return !$scope.searchTerm || 
                keyword.test(patient.name) || 
                keyword.test(patient.primary_phone) || 
                keyword.test(patient.email);
    };
};

var patientController = function($scope, $log, $routeParams, $modal, $location, Patient, Appointment, Payment)
{
    $scope.appointment = null;
    $scope.patient = {};
    $scope.debt = 0;
    $scope.alerts = [];

    // load the patient
    Patient.get({id: $routeParams.id, appointments: true, payments: true}, function(patient)
    {
        // get all patients
        $scope.patient = patient;

        calculateDebt();
    });

    function updateActiveTab(activeTab)
    {
        $scope.activeTab = activeTab;        
    }

    function getAppointmentPrice(patient, appointment)
    {
        if (appointment.hasOwnProperty('price'))
            return appointment.price;
        else
            return patient.appointment_price;
    }

    function addAlert(type, message)
    {
        $scope.alerts.push({type: type, msg: message});
    }

    function calculateDebt()
    {
        $scope.debt = 0;

        // iterate over all the appointments, check for those without payment and calculate
        // how much this low life owns
        $scope.patient.appointments.forEach(function(appointment)
        {
            if (!appointment.hasOwnProperty('payment') &&
                Date.parse(appointment.when) < Date.now())
            {
                $scope.debt += getAppointmentPrice(patient, appointment);
            }
        });
    }

    function getAppointmentIndexById(patient, id)
    {
        for (var idx = 0; idx < patient.appointments.length; ++idx)
            if (patient.appointments[idx]._id == id)
                return idx;
    }

    function getAppointmentById(patient, id)
    {
        idx = getAppointmentIndexById(patient, id);
        return patient.appointments[idx];
    }

    function removeAppointmentById(id)
    {
        idx = getAppointmentIndexById($scope.patient, id);
        $scope.patient.appointments.splice(idx, 1);
    }

    $scope.update = function()
    {
        Patient.update({id: $scope.patient._id}, $scope.patient, function()
        {
            $location.path('patients');
        });
    };

    $scope.cancel = function()
    {
        $location.path('patients');
    };

    $scope.viewAppointment = function(appointment)
    {

        // pop up the modal
        appointmentModal = $modal.open({templateUrl: './partials/appointment',
                                        controller: appointmentModalController,
                                        size: 'sm',
                                        resolve:
                                        {
                                            patient: function(){return $scope.patient;},
                                            appointment: function(){return angular.copy(appointment);},
                                            mode: function(){return 'edit';}
                                        }});

        appointmentModal.result.then(function(modifiedAppointment)
        {
            if (!modifiedAppointment.remove)
            {
                // update in server
                Appointment.update({id: modifiedAppointment.appointment._id}, modifiedAppointment.appointment, function(dbObject)
                {
                    // reinsert
                    removeAppointmentById(modifiedAppointment.appointment._id);
                    $scope.patient.appointments.push(dbObject);

                    calculateDebt();
                });
            }
            else
            {
                Appointment.delete({id: modifiedAppointment.appointment._id}, function()
                {
                    removeAppointmentById(modifiedAppointment.appointment._id);           

                    calculateDebt();
                });
            }
        });
    };

    $scope.createAppointment = function()
    {
        // pop up the modal
        appointmentModal = $modal.open({templateUrl: './partials/appointment',
                                        controller: appointmentModalController,
                                        size: 'sm',
                                        resolve:
                                        {
                                            patient: function(){return $scope.patient;},
                                            appointment: function()
                                            {
                                                return {
                                                    patient: $scope.patient._id,
                                                    when: (new Date()).setMinutes(0),
                                                    price: $scope.patient.appointment_price
                                                };
                                            },
                                            mode: function(){return 'create';}
                                        }});

        appointmentModal.result.then(function(newAppointment)
        {
            // update in server
            Appointment.save(newAppointment.appointment, function(dbObject)
            {
                $scope.patient.appointments.push(dbObject);

                calculateDebt();
            });
        });
    };

    $scope.createPayment = function()
    {
        // pop up the modal
        paymentModal = $modal.open({templateUrl: './partials/payment',
                                    controller: paymentModalController,
                                    size: 'sm',
                                    resolve:
                                    {
                                        patient: function(){return $scope.patient;},
                                        debt: function(){return $scope.debt;},
                                    }});

        paymentModal.result.then(function(newPayment)
        {
            // update in server
            Payment.save(newPayment, 

                            // success
                            function(dbObject)
                            {
                                // shove this payment to the list
                                $scope.patient.payments.push(dbObject);

                                // update appointments with their new payments
                                dbObject.appointments.forEach(function(appointmentId)
                                {
                                    getAppointmentById($scope.patient, appointmentId).payment = dbObject._id;
                                });

                                // recalulate patient debt
                                calculateDebt();
                            },

                            // error
                            function(response)
                            {
                                addAlert('danger', 'Error creating payment: ' + response.data.error);
                            });
        });
    };

    $scope.toggleAppointmentBoolean = function(appointment, name)
    {
        appointmentCopy = angular.copy(appointment);
        appointmentCopy[name] = !appointmentCopy[name];

        // update in server
        Appointment.update({id: appointmentCopy._id}, 
                            appointmentCopy, function(dbObject)
        {
            appointment[name] = !appointment[name];
        });
    };

    $scope.toggleAppointmentSummarized = function(appointment)
    {
        if (Date.parse(appointment.when) <= Date.now())
        {
            $scope.toggleAppointmentBoolean(appointment, 'summary_sent');
        }
    };

    $scope.closeAlert = function(index) 
    {
        $scope.alerts.splice(index, 1);
    };

    $scope.getAppointmentClass = function(appointment)
    {
        if (Date.parse(appointment.when) <= Date.now())
            return 'past-appointment';
        else
            return 'future-appointment';
    };

    $scope.getAppointmentPaidIcon = function(appointment)
    {
        if (Date.parse(appointment.when) > Date.now())      return 'glyphicon glyphicon-minus';
        else if (appointment.hasOwnProperty('payment'))     return 'glyphicon glyphicon-ok';
        else                                                return 'glyphicon glyphicon-remove';     
    };

    $scope.getAppointmentSummaryIcon = function(appointment)
    {
        if (Date.parse(appointment.when) > Date.now()) return 'glyphicon glyphicon-minus';
        else if (appointment.summary_sent)             return 'glyphicon glyphicon-ok';
        else                                           return 'glyphicon glyphicon-remove';     
    };
};

var appointmentModalController = function($scope, $modalInstance, patient, appointment, mode) 
{
    $scope.dt = Date.now();
    $scope.appointment = appointment;
    $scope.mode = mode;
    $scope.patient = patient;
    $scope.opened = false;

    $scope.update = function()
    {
        $scope.appointment.price = parseInt($scope.appointment.price);
        $modalInstance.close({appointment: $scope.appointment, remove: false});
    };

    $scope.cancel = function()
    {
        $modalInstance.dismiss('cancel');
    };

    $scope.delete = function()
    {
        $modalInstance.close({appointment: $scope.appointment, remove: true});
    };

    $scope.do_open = function($event) 
    {
        console.log("foo");
        $event.preventDefault();
        $event.stopPropagation();

        $scope.opened = true;
    };
};

var patientModalController = function($scope, $modalInstance) 
{
    $scope.patient = {appointment_price: 330};

    $scope.create = function()
    {
        $modalInstance.close($scope.patient);
    };

    $scope.cancel = function()
    {
        $modalInstance.dismiss('cancel');
    };
};

var paymentModalController = function($scope, $modalInstance, patient, debt) 
{
    $scope.debt = debt;
    $scope.payment = {sum: debt, patient: patient._id};

    $scope.create = function()
    {
        $scope.payment.when = Date.now();
        $modalInstance.close($scope.payment);
    };

    $scope.cancel = function()
    {
        $modalInstance.dismiss('cancel');
    };
};


var appointmentsController = function($scope, Appointment) 
{
    $scope.appointments = [];

    Appointment.query({populate_patient: true}, function(appointments)
    {
        $scope.appointments = appointments;
    });
};

angular.module('tms.patient.controllers', 
[
    'ui.bootstrap',
    'ui.bootstrap.tpls',
    'tms.appointment.controllers',
    'tms.payment.controllers',
    'tms.patient.services',
    'tms.payment.services',
])

.config(['$routeProvider', function ($routeProvider) 
{
    $routeProvider

    .when('/patients', 
    {
        templateUrl:'partials/patients',
        controller:'PatientListController',
    })

    .when('/patients/:id', 
    {
        templateUrl:'partials/patient',
        controller:'PatientDetailController',
    });

}])

.controller('PatientListController', 
            ['$scope', '$log', '$location', '$modal', 'Patient', 
            function($scope, $log, $location, $modal, Patient) 
{
    // create a new patient
    $scope.create = function()
    {
        patientModal = $modal.open({templateUrl: './partials/patient-modal',
                                    controller: 'PatientModalController'});

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

    $scope.searchTerm = '';

    // pagination
    $scope.patients = [];

    // get all patients
    Patient.query(function(patients)
    {
        $scope.patients = patients;
    });
}])

.controller('PatientDetailController', 
            ['$scope', '$log', '$routeParams', '$modal', '$location', 'Patient', 'Appointment', 'Payment', 
            function($scope, $log, $routeParams, $modal, $location, Patient, Appointment, Payment) 
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
        appointmentModal = $modal.open({templateUrl: './partials/appointment-modal',
                                        controller: 'AppointmentModalController',
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
        appointmentModal = $modal.open({templateUrl: './partials/appointment-modal',
                                        controller: 'AppointmentModalController',
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
        paymentModal = $modal.open({templateUrl: './partials/payment-modal',
                                    controller: 'PaymentModalController',
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
}])

.controller('PatientModalController', 
            ['$scope', '$modalInstance', 
            function($scope, $modalInstance) 
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
}]);

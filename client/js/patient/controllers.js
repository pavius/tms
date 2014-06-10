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
                keyword.test(patient.primaryPhone) ||
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
    Patient.get({id: $routeParams.id}, function(patient)
    {
        $scope.patient = patient;
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
            return patient.appointmentPrice;
    }

    function addAlert(type, message)
    {
        $scope.alerts.push({type: type, msg: message});
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


    // response will arrive with appointments/payments. we don't want that. we just want to update
    // the patient stuff
    function updateScopePatientWithResponse(patientResponse)
    {
        // save into scope
        $scope.patient.status = patientResponse.status;
        $scope.patient.debt = patientResponse.debt;
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
                Appointment.update({patientId: $scope.patient._id,
                                    id: modifiedAppointment.appointment._id},
                                    modifiedAppointment.appointment, function(dbObject)
                {
                    // reinsert
                    removeAppointmentById(modifiedAppointment.appointment._id);
                    $scope.patient.appointments.push(dbObject.appointments[0]);

                    // update patient
                    updateScopePatientWithResponse(dbObject);
                });
            }
            else
            {
                Appointment.delete({patientId: $scope.patient._id,
                                    id: modifiedAppointment.appointment._id}, function(dbObject)
                {
                    removeAppointmentById(modifiedAppointment.appointment._id);

                    // update patient
                    updateScopePatientWithResponse(dbObject);
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
                                                    price: $scope.patient.appointmentPrice
                                                };
                                            },
                                            mode: function(){return 'create';}
                                        }});

        appointmentModal.result.then(function(newAppointment)
        {
            // update in server
            Appointment.save({patientId: $scope.patient._id}, newAppointment.appointment, function(dbObject)
            {
                $scope.patient.appointments.push(dbObject.appointments[0]);

                // update patient
                updateScopePatientWithResponse(dbObject);
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
                                        patient: function(){return $scope.patient;}
                                    }});

        paymentModal.result.then(function(newPayment)
        {
            // update in server
            Payment.save({patientId: $scope.patient._id}, newPayment,

                            // success
                            function(dbObject)
                            {
                                // shove this payment to the list
                                $scope.patient.payments.push(dbObject.payments[0]);

                                // update patient
                                updateScopePatientWithResponse(dbObject);

                                // update appointments with their new payments
                                dbObject.appointments.forEach(function(appointment)
                                {
                                    getAppointmentById($scope.patient, appointment._id).payment = dbObject.payments[0]._id;
                                });
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
        Appointment.update({patientId: $scope.patient._id, id: appointmentCopy._id},
                            appointmentCopy, function(dbObject)
        {
            appointment[name] = !appointment[name];
        });
    };

    $scope.toggleAppointmentSummarized = function(appointment)
    {
        if (Date.parse(appointment.when) <= Date.now())
        {
            $scope.toggleAppointmentBoolean(appointment, 'summarySent');
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
        else if (appointment.payment !== null)              return 'glyphicon glyphicon-ok';
        else                                                return 'glyphicon glyphicon-remove';     
    };

    $scope.getAppointmentSummaryIcon = function(appointment)
    {
        if (Date.parse(appointment.when) > Date.now()) return 'glyphicon glyphicon-minus';
        else if (appointment.summarySent)              return 'glyphicon glyphicon-ok';
        else                                           return 'glyphicon glyphicon-remove';     
    };
}])

.controller('PatientModalController', 
            ['$scope', '$modalInstance', 
            function($scope, $modalInstance) 
{
    $scope.patient = {appointmentPrice: 330};

    $scope.create = function()
    {
        $modalInstance.close($scope.patient);
    };

    $scope.cancel = function()
    {
        $modalInstance.dismiss('cancel');
    };
}]);

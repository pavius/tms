angular.module('tms.patient.controllers', 
[
    'ui.bootstrap',
    'ui.bootstrap.tpls',
    'tms.common.services',
    'tms.appointment.controllers',
    'tms.payment.controllers',
    'tms.patient.services',
    'tms.payment.services'
])

.config(['$routeProvider', function ($routeProvider) 
{
    $routeProvider

    .when('/patients', 
    {
        templateUrl:'partials/patients',
        controller:'PatientListController'
    })

    .when('/patients/:id', 
    {
        templateUrl:'partials/patient',
        controller:'PatientDetailController'
    });

}])

.controller('PatientListController', 
            ['$scope', '$log', '$location', '$modal', 'ErrorHandler', 'Patient',
            function($scope, $log, $location, $modal, errorHandler, Patient)
{
    $scope.searchTerm = '';
    $scope.showActivePatientsOnly = true;
    $scope.patients = [];
    $scope.errorHandler = errorHandler;

    // create a new patient
    $scope.create = function()
    {
        patientModal = $modal.open({templateUrl: './partials/patient-modal',
                                    controller: 'PatientModalController'});

        patientModal.result.then(function(newPatient)
        {
            Patient.save(newPatient,
                function(dbObject)
                {
                    // shove to view
                    $scope.patients.push(dbObject);
                },
                function(error)
                {
                    $scope.errorHandler.handleError('create patient', error);
                });
        });
    };

    $scope.reloadPatients = function()
    {
        $scope.patients = [];

        function addPatientsIfUnique(patients)
        {
            patients.forEach(function(patient)
            {
                if (!_.findWhere($scope.patients, {_id: patient._id}))
                {
                    $scope.patients.push(patient);
                }
            });
        }

        function handlePatientLoadError(error)
        {
            $scope.errorHandler.handleError('load patients', error);
        }

        // do we need only to get active/new patients?
        if ($scope.showActivePatientsOnly)
        {
            // requires two queries
            async.parallel(
                [
                    // get all patients who do not have manual status and are active/new
                    function(callback)
                    {
                        Patient.query({manualStatus: 'undefined', status: '^active|new', select: '-appointments'}, addPatientsIfUnique, handlePatientLoadError);
                    },

                    // get all patients who are manually defined as active/new
                    function(callback)
                    {
                        Patient.query({manualStatus: '^active|new', select: '-appointments'}, addPatientsIfUnique, handlePatientLoadError);
                    }
                ]
            );
        }
        else
        {
            // just get'em all
            Patient.query({select: '-appointments'}, addPatientsIfUnique, handlePatientLoadError);
        }
    };

    $scope.searchFilter = function(patient)
    {
        var keyword = new RegExp($scope.searchTerm, 'i');
        return !$scope.searchTerm ||
               keyword.test(patient.name) ||
               keyword.test(patient.primaryPhone) ||
               keyword.test(patient.email);
    };

    $scope.getPatientGlyphIconByHasAppointment = function(patient)
    {
        switch(patient.status)
        {
            case 'active': return 'glyphicon glyphicon-plus';
            case 'inactive': return 'glyphicon glyphicon-minus';
            case 'new': return 'glyphicon glyphicon-asterisk';
            default: return '';
        }
    }

    // do the reload
    $scope.reloadPatients();
}])

.controller('PatientDetailController', 
            ['$scope', '$log', '$routeParams', '$modal', '$location', 'ErrorHandler', 'Patient', 'Appointment', 'AppointmentModal', 'Payment',
            function($scope, $log, $routeParams, $modal, $location, errorHandler, Patient, Appointment, AppointmentModal, Payment)
{
    $scope.appointment = null;
    $scope.patient = {};
    $scope.debt = 0;
    $scope.alerts = [];
    $scope.calculatedStatus = '';
    $scope.inactivityReason = {open: false};
    $scope.errorHandler = errorHandler;

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

    function translateStatus(status)
    {
        switch(status)
        {
            case 'new': return 'חדש';
            case 'active': return 'בתהליך';
            case 'inactive': return 'לא פעיל';
            default: return 'לא ידוע';
        }
    }

    // choose between manual and automatic status
    function getEffectiveStatus()
    {
        if ($scope.patient.manualStatus == 'undefined' ||
            $scope.patient.manualStatus == 'recalculate')
            return $scope.patient.status;
        else
            return $scope.patient.manualStatus;
    }

    $scope.$watch('patient.status + patient.manualStatus', function()
    {
        $scope.effectiveStatus = translateStatus(getEffectiveStatus());
    });

    $scope.update = function()
    {
        Patient.update({id: $scope.patient._id}, $scope.patient,
            function()
            {
                $location.path('patients');
            },
            function(error)
            {
                $scope.errorHandler.handleError('update patient', error);
            });
    };

    $scope.cancel = function()
    {
        $location.path('patients');
    };

    $scope.createAppointment = function()
    {
        // pop up the modal
        AppointmentModal.create($scope.patient,
            function(updatedPatient)
            {
                $scope.patient.appointments.push(updatedPatient.appointments[0]);

                // update patient
                updateScopePatientWithResponse(updatedPatient);
            });
    };

    $scope.updateAppointment = function(appointment)
    {
        // pop up the modal
        AppointmentModal.update($scope.patient, appointment,
            // updated
            function(updatedPatient)
            {
                // reinsert
                removeAppointmentById(appointment._id);
                $scope.patient.appointments.push(updatedPatient.appointments[0]);

                // update patient
                updateScopePatientWithResponse(updatedPatient);
            },
            // deleted
            function(updatedPatient)
            {
                removeAppointmentById(appointment._id);

                // update patient
                updateScopePatientWithResponse(updatedPatient);
            });
    };

    $scope.createPayment = function()
    {
        // pop up the modal
        paymentModal = $modal.open({templateUrl: './partials/payment-modal',
                                    controller: 'PaymentModalController',
                                    windowClass: 'payment',
                                    size: 'sm',
                                    resolve:
                                    {
                                        patient: function(){return $scope.patient;}
                                    }});

        paymentModal.result.then(function(newPayment)
        {
            // update in server
            Payment.save({patientId: $scope.patient._id}, newPayment,
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
                function(error)
                {
                    $scope.errorHandler.handleError('create payment', error);
                });
        });
    };

    $scope.toggleAppointmentBoolean = function(appointment, name)
    {
        appointmentCopy = angular.copy(appointment);
        appointmentCopy[name] = !appointmentCopy[name];

        // update in server
        Appointment.update({patientId: $scope.patient._id, id: appointmentCopy._id},
                            appointmentCopy,
            function(dbObject)
            {
                appointment[name] = !appointment[name];
            },
            function(error)
            {
                $scope.errorHandler.handleError('update appointment', error);
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

    // load the patient
    Patient.get({id: $routeParams.id},
        function(patient)
        {
            $scope.patient = patient;
        },
        function(error)
        {
            $scope.errorHandler.handleError('read patient info', error);
        }
    );
}])

.controller('PatientModalController', 
            ['$scope', '$modalInstance', 
            function($scope, $modalInstance) 
{
    $scope.patient = {appointmentPrice: 350};

    $scope.create = function()
    {
        $modalInstance.close($scope.patient);
    };

    $scope.cancel = function()
    {
        $modalInstance.dismiss('cancel');
    };
}]);

angular.module('tms.appointment.controllers', [])

.config(['$routeProvider', function ($routeProvider) 
{
    $routeProvider

    .when('/appointments', 
    {
        templateUrl: 'partials/appointments',
        controller: 'AppointmentListController'
    });
}])

.controller('AppointmentListController', 
            ['$scope', 'Appointment', 
            function($scope, Appointment) 
{
    $scope.appointments = [];
}])

.controller('AppointmentModalController', 
            ['$scope', '$modalInstance', 'Appointment', 'Patient', 'mode', 'patient', 'appointment',
            function($scope, $modalInstance, Appointment, Patient, mode, patient, appointment)
{
    $scope.dt = Date.now();
    $scope.mode = mode;
    $scope.patient = patient;
    $scope.appointment = angular.copy(appointment);
    $scope.opened = false;
    $scope.patients = null;
    $scope.selectedPatientIdx = null;

    function patientDropdownFormat(patient)
    {
        return patient.name;
    }

    $scope.createOrUpdate = function()
    {
        $scope.appointment.price = parseInt($scope.appointment.price);

        if (mode == 'create')
        {
            // update in server
            Appointment.save({patientId: $scope.patient._id}, $scope.appointment, function(dbObject)
                {
                    $modalInstance.close({updatedPatient: dbObject, status: 'create'});
                },
                function(error)
                {
                    $modalInstance.close({status: 'Error creating appointment'});
                });
        }
        else if (mode == 'update')
        {
            // update in server
            Appointment.update({patientId: $scope.patient._id, id: $scope.appointment._id},
                               $scope.appointment,
                function(dbObject)
                {
                    $modalInstance.close({updatedPatient: dbObject, status: 'update'});
                },
                function(error)
                {
                    $modalInstance.close({status: 'Error updating appointment'});
                });
        }
        else
        {
            $modalInstance.close({status: 'Invalid mode'});
        }
    };

    $scope.cancel = function()
    {
        $modalInstance.dismiss({result: 'cancelled'});
    };

    $scope.delete = function()
    {
        Appointment.delete({patientId: $scope.patient._id, id: $scope.appointment._id},
            function(dbObject)
            {
                $modalInstance.close({updatedPatient: dbObject, status: 'delete'});
            },
            function(error)
            {
                $modalInstance.close({status: 'Error deleting appointment'});
            });
    };

    $scope.do_open = function($event) 
    {
        $event.preventDefault();
        $event.stopPropagation();

        $scope.opened = true;
    };

    // configure patient dropdown
    $scope.patientDropdownConfig =
    {
        placeholder: "בחר מטופל",
    }

    // on open, if there is no patient defined, we need to load the dropdown
    if ($scope.patient === null)
    {
        // get all patients
        Patient.query({select: '_id name appointmentPrice'},
            function(patients)
            {
                patientsArray = [];

                patients.forEach(function(patient)
                {
                    patientsArray.push(patient);
                })

                $scope.patients = _.sortBy(patientsArray, function(p) { return p.name; });
            });

        // on patient change
        $scope.$watch('selectedPatientIdx', function(newValue, oldValue)
        {
            if (newValue)
            {
                $scope.patient = $scope.patients[$scope.selectedPatientIdx];
                $scope.appointment.price = $scope.patient.appointmentPrice;
            }
        });
    }
}]);

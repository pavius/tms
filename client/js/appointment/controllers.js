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
            ['$scope', '$modalInstance', 'Appointment', 'mode', 'patient', 'appointment',
            function($scope, $modalInstance, Appointment, mode, patient, appointment)
{
    $scope.dt = Date.now();
    $scope.mode = mode;
    $scope.patient = patient;
    $scope.appointment = angular.copy(appointment);
    $scope.opened = false;

    $scope.createOrUpdate = function()
    {
        $scope.appointment.price = parseInt($scope.appointment.price);

        if (mode == 'create')
        {
            // update in server
            Appointment.save({patientId: $scope.patient._id}, appointment, function(dbObject)
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
        console.log("foo");
        $event.preventDefault();
        $event.stopPropagation();

        $scope.opened = true;
    };
}]);

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

    Appointment.query({populate_patient: true}, function(appointments)
    {
        $scope.appointments = appointments;
    });
}])

.controller('AppointmentModalController', 
            ['$scope', '$modalInstance', 'patient', 'appointment', 'mode', 
            function($scope, $modalInstance, patient, appointment, mode) 
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
}]);

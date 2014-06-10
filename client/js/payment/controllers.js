angular.module('tms.payment.controllers', [])

.config(['$routeProvider', function ($routeProvider) 
{
}])

.controller('PaymentModalController', 
            ['$scope', '$modalInstance', 'patient',
            function($scope, $modalInstance, patient)
{
    $scope.payment = {sum: patient.debt.total, patient: patient._id};

    $scope.create = function()
    {
        $scope.payment.when = Date.now();
        $modalInstance.close($scope.payment);
    };

    $scope.cancel = function()
    {
        $modalInstance.dismiss('cancel');
    };
}]);

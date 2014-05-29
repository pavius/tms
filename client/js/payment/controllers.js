angular.module('tms.payment.controllers', [])

.config(['$routeProvider', function ($routeProvider) 
{
}])

.controller('PaymentModalController', 
            ['$scope', '$modalInstance', 'patient', 'debt', 
            function($scope, $modalInstance, patient, debt) 
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
}]);

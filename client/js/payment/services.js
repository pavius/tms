angular.module('tms.payment.services', ['ngResource'])

.factory('Payment', ['$resource', function($resource)
{
    var Payment = $resource('api/patients/:patientId/payments/:id', {},
    {
        update: {method:'PUT'}
    });

    return Payment; 
}]);

angular.module('tms.payment.controllers', [])

.config(['$routeProvider', function ($routeProvider) 
{
}])

.controller('PaymentModalController',
            ['$scope', '$modalInstance', '$interval', 'Patient', 'Payment', 'mode', 'patient', 'payment',
            function($scope, $modalInstance, $interval, Patient, Payment, mode, patient, payment)
{
    $scope.mode = mode;
    $scope.patient = patient;
    $scope.payment = payment;
    $scope.inProgress = false;

    $scope.createOrUpdate = function()
    {
        // indicate that we're in progress so that the user can't do stupid stuff while we're interacting
        // with the server
        $scope.inProgress = true;

        // update payment date
        $scope.payment.when = Date.now();

        // are we creating?
        if (mode == 'create')
        {
            // update in server
            Payment.save({patientId: $scope.patient._id}, $scope.payment, function(updatedPatient)
                {
                    var attempt = 0;

                    // start polling for the payment's invoice. once the invoice is there (or a certain time passes
                    // we can close the modal)
                    invoicePoller = $interval(function()
                        {
                            // get payment
                            Payment.get({patientId: $scope.patient._id, id: updatedPatient.payments[0]._id}, function(updatedPayment)
                            {
                                // update the payment in the patient
                                console.log(updatedPayment);
                                updatedPatient.payments[0] = updatedPayment;

                                // if there's an invoice url, close
                                if (updatedPayment.invoice.url)
                                {
                                    $modalInstance.close({updatedPatient: updatedPatient, status: 'create'});
                                    $interval.cancel(invoicePoller);
                                }
                                else if (attempt++ >= 20)
                                {
                                    $modalInstance.close({status: 'Timed out waiting for invoice'});
                                    $interval.cancel(invoicePoller);
                                }
                            })
                        }, 500);
                },
                function(error)
                {
                    $modalInstance.close({status: 'Error creating payment'});
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
}]);

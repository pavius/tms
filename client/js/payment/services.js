angular.module('tms.payment.services', ['ngResource'])

.factory('Payment', ['$resource', function($resource)
{
    var Payment = $resource('api/patients/:patientId/payments/:id', {},
    {
        update: {method:'PUT'}
    });

    return Payment; 
}])
.service('PaymentModal', ['$modal', function($modal)
{
    function openModal(mode, patient, payment)
    {
        return $modal.open({templateUrl: './partials/payment-modal',
            controller: 'PaymentModalController',
            windowClass: 'payment',
            size: 'md',
            resolve:
            {
                patient: function() {return patient},
                payment: function() {return payment;},
                mode: function() {return mode;}
            }});
    }

    this.create = function(patient, successCallback, errorCallback)
    {
        // build the default payment, based on the fact that it belongs to a certain patient
        payment = {
            sum: patient.debt.total,
            patient: patient._id,
            emailInvoice: patient.email ? true : false,
            transaction:
            {
                type: 'cash',
                invoiceRecipient: patient.invoiceRecipient || patient.name,
                cheque:
                {
                    number: '',
                    date: new Date(),
                    bank:
                    {
                        name: patient.bank ? patient.bank.name : '',
                        branch: patient.bank ? patient.bank.branch : '',
                        account: patient.bank ? patient.bank.account: ''
                    }
                },
                transfer:
                {
                    date: new Date(),
                    bank:
                    {
                        name: patient.bank ? patient.bank.name : '',
                        branch: patient.bank ? patient.bank.branch : '',
                        account: patient.bank ? patient.bank.account: ''
                    }
                }
            }
        };

        // pop up the modal
        paymentModal = openModal('create', patient, payment);

        paymentModal.result.then(function(result)
        {
            if (result.status == 'create')
            {
                successCallback(result.updatedPatient);
            }
            else
            {
                errorCallback(result.status);
            }
        });
    }
}]);

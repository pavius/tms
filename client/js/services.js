tmsServices = angular.module('tms.services', ['ngResource']);

function buildDates(response)
{
    var data = response.data, key, value;

    for (key in data) 
    {
        if (!data.hasOwnProperty(key) && toString.call(data[key]) !== '[object String]') continue;
        value = Date.parse(data[key]);
        console.log(data[key]);

        if (!isNan(value)) 
            data[key] = value;
    }

    return response;
}

//
// Resources
//


//
// Factories
//

tmsServices.factory('Patient', ['$resource', function($resource)
{
    var Patient = $resource('api/patients/:id', {}, 
    {
        update: {method:'PUT'}
    });

    return Patient; 
}]);

tmsServices.factory('Appointment', ['$resource', function($resource)
{
    var Appointment = $resource('api/appointments/:id', {}, 
    {
        update: {method:'PUT'}
    });

    return Appointment;
}]);

tmsServices.factory('Payment', ['$resource', function($resource)
{
    var Payment = $resource('api/payments/:id', {}, 
    {
        update: {method:'PUT'}
    });

    return Payment;
}]);
angular.module('tms.dashboard.controllers', 
[
    'tms.patient.services',
    'tms.todo.services',
    'tms.common.services'
])

.config(['$routeProvider', function ($routeProvider)
{
    $routeProvider

        .when('/', 
        {
            templateUrl: 'partials/dashboard',
            controller: 'DashboardController'
        });
}]) 

.controller('DashboardController',
            ['$scope', '$location', 'ErrorHandler', 'Patient', 'Todo', 'AppointmentModal',
            function($scope, $location, errorHandler, Patient, Todo, AppointmentModal)
{
    $scope.todos = [];
    $scope.appointmentsThisWeek = [];
    $scope.appointmentsNextWeek = [];
    $scope.errorHandler = errorHandler;
    $scope.totalNumberOfAppointmentsThisWeek = 0;

    $scope.completeTodoAndRemove = function(todo, index)
    {
        if (todo.done)
        {
            todo.complete(function()
            {
                $scope.todos.splice(index, 1);
            });
        }
    }

    function checkPatientDebtAndCreateTodo(patient)
    {
        // if patients oldest unpaid appointment is 2 months old, we want to know about it
        if (patient.debt.total &&
            (Date.now() - Date.parse(patient.debt.oldestNonPaidAppointment)) > (2 * 31 * 24 * 60 * 60 * 1000))
        {
            $scope.todos.push(Todo.createCollectDebtTodo(patient, patient.debt));
        }
    }

    $scope.createAppointment = function()
    {
        AppointmentModal.create(null, function(updatedPatient)
        {
            $scope.errorHandler.openAlert('success', "פגישה עם " + updatedPatient.name + " נוצרה בהצלחה");
        });
    }

    // get all active patients along with relevant appointment info
    Patient.query({status: '^active|new',
                   select: 'name status manualStatus debt lastContact appointments._id appointments.when appointments.summarySent'},
        function(patients)
        {
            var dayInMs = 24 * 60 * 60 * 1000;
            var now = new Date();

            // get start of week without time element
            var thisWeekStartDate = new Date(now - (now.getDay() * dayInMs));
            thisWeekStartDate = new Date(thisWeekStartDate.getFullYear(), thisWeekStartDate.getMonth(), thisWeekStartDate.getDate());

            patients.forEach(function (patient)
            {
                var patientHasFutureAppointment = false;

                // scan appointments and do stuff
                patient.appointments.forEach(function (appointment)
                {
                    var appointmentDate = Date.parse(appointment.when);

                    // is this an appointment which occurred this week?
                    if ((appointmentDate >= thisWeekStartDate.getTime()) && (appointmentDate <= thisWeekStartDate.getTime() + 7 * dayInMs))
                    {
                        $scope.totalNumberOfAppointmentsThisWeek++;
                    }

                    // is this an appointment which occurred in teh past?
                    if (appointmentDate <= Date.now())
                    {
                        // is it unsummarized?
                        if (!appointment.summarySent)
                            $scope.todos.push(Todo.createSummarizeAppointmentTodo(patient, appointment));
                    }
                    // future appointment
                    else
                    {
                        patientHasFutureAppointment = true;

                        var daysUntilSaturday = 7 /* saturday */ - now.getDay();
                        var appointmentDaysFromNow = (appointmentDate - now) / dayInMs;

                        // is it this week?
                        if (appointmentDaysFromNow < daysUntilSaturday)
                        {
                            appointment.patient = patient;
                            $scope.appointmentsThisWeek.push(appointment);
                        }
                        // is it next week?
                        else if (appointmentDaysFromNow < (daysUntilSaturday + 7))
                        {
                            appointment.patient = patient;
                            $scope.appointmentsNextWeek.push(appointment);
                        }
                    }
                });

                // check for outstanding debt
                checkPatientDebtAndCreateTodo(patient);

                if (patient.getStatus() == 'new')
                {
                    // check if we need to contact this new patient
                    if ((Date.now() - Date.parse(patient.lastContact)) > (4 * 24 * 60 * 60 * 1000))
                    {
                        $scope.todos.push(Todo.createContactPatientTodo(patient));
                    }

                    // check if this patient has an appointment
                    if (!patientHasFutureAppointment)
                    {
                        $scope.todos.push(Todo.createSetPatientAppointment(patient));
                    }
                }
            });
        },
        function(error)
        {
            $scope.errorHandler.handleError('read active patients', error);
        }
    );

    // get all inactive patients and check for debt
    Patient.query({status: 'inactive',
                   select: 'name debt'},
        function(patients)
        {
            patients.forEach(function(patient)
            {
                checkPatientDebtAndCreateTodo(patient);
            });
        },
        function(error)
        {
            $scope.errorHandler.handleError('read inactive patients', error);
        });
}]);
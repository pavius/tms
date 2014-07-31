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
            ['$scope', '$location', 'ErrorHandler', 'Patient', 'Todo', 'TodoModal', 'AppointmentModal', 'PaymentModal',
            function($scope, $location, errorHandler, Patient, Todo, TodoModal, AppointmentModal, PaymentModal)
{
    $scope.loading = true;
    $scope.todos = [];
    $scope.lowPriorityTodos = [];
    $scope.appointmentsThisWeek = [];
    $scope.appointmentsNextWeek = [];
    $scope.errorHandler = errorHandler;
    $scope.totalNumberOfAppointmentsThisWeek = 0;
    $scope.patientsWithRecentAppointments = [];
    $scope.dropdownStatus = {fastPayment: false};

    function checkPatientDebtAndCreateTodo(patient)
    {
        // if patients oldest unpaid appointment is 2 months old, we want to know about it
        if (patient.debt.total &&
            (Date.now() - Date.parse(patient.debt.oldestNonPaidAppointment)) > (2 * 31 * 24 * 60 * 60 * 1000))
        {
            addTodoToArray(Todo.createCollectDebtTodo(patient, patient.debt), $scope.lowPriorityTodos);
        }
    }

    function addTodoToArray(todo, array)
    {
        array.push(todo);
        todo.array = array;
    }

    function addCustomTodo(todo)
    {
        dashboardTodo = Todo.createCustomTodo(todo);

        if (todo.type == 'urgent')
            addTodoToArray(dashboardTodo, $scope.todos);
        else
            addTodoToArray(dashboardTodo, $scope.lowPriorityTodos);
    }

    function getDayInMs()
    {
        return 24 * 60 * 60 * 1000;
    }

    function getStartOfWeekDate()
    {
        now = new Date();

        // get start of week without time element
        var thisWeekStartDate = new Date(now - (now.getDay() * getDayInMs()));
        return new Date(thisWeekStartDate.getFullYear(), thisWeekStartDate.getMonth(), thisWeekStartDate.getDate());
    }

    function getEndOfWeekDate()
    {
        var thisWeekEndDate = new Date(getStartOfWeekDate().getTime() + 6 * getDayInMs());
        return new Date(thisWeekEndDate.getFullYear(), thisWeekEndDate.getMonth(), thisWeekEndDate.getDate(), 23, 59, 59);
    }

    $scope.fastPaymentClick = function(patient)
    {
        // close the dropdown
        $scope.dropdownStatus.fastPayment = false;

        // pop up the payment modal
        PaymentModal.create(patient,
            function(updatedPatient)
            {
                $scope.errorHandler.openAlert('success', "תשלום נוצר בהצלחה עבור " + patient.name);

                loadPatientsWithRecentAppointments();
            },
            function(error)
            {
                $scope.errorHandler.handleError('create payment', {statusText: error});
            });
    }

    $scope.completeTodoAndRemove = function(todo, index)
    {
        if (todo.done)
        {
            todo.complete(function()
            {
                todo.array.splice(todo.array.indexOf(todo), 1);
            });
        }
    }

    $scope.createAppointment = function()
    {
        AppointmentModal.create(null, function(updatedPatient)
        {
            $scope.errorHandler.openAlert('success', "פגישה עם " + updatedPatient.name + " נוצרה בהצלחה");
        });
    }

    $scope.createTodo = function()
    {
        TodoModal.create(function(updatedTodo)
        {
            addCustomTodo(updatedTodo);
        });
    }

    function loadActivePatients(callback)
    {
        // get all active patients along with relevant appointment info
        Patient.query({status: '^active|new',
                select: 'name email bank status manualStatus debt lastContact appointments._id appointments.when appointments.summarySent appointments.type'},
            function(patients)
            {
                patients.forEach(function (patient)
                {
                    var patientHasFutureAppointment = false;

                    // scan appointments and do stuff
                    patient.appointments.forEach(function (appointment)
                    {
                        var appointmentDate = Date.parse(appointment.when);
                        weekStart = getStartOfWeekDate();
                        weekEnd = getEndOfWeekDate();
                        nextWeekEnd = new Date(getEndOfWeekDate().getTime() + (7 * getDayInMs()) - 1000);

                        // is this an appointment which occurred this week?
                        if ((appointmentDate >= weekStart.getTime()) && (appointmentDate <= weekEnd.getTime()))
                        {
                            $scope.totalNumberOfAppointmentsThisWeek++;
                        }

                        // is this an appointment which occurred in teh past?
                        if (appointmentDate <= Date.now())
                        {
                            // is it unsummarized?
                            if (!appointment.summarySent)
                                addTodoToArray(Todo.createSummarizeAppointmentTodo(patient, appointment), $scope.todos);
                        }
                        // future appointment
                        else
                        {
                            patientHasFutureAppointment = true;

                            // is it this week?
                            if (appointmentDate <= weekEnd)
                            {
                                appointment.patient = patient;
                                $scope.appointmentsThisWeek.push(appointment);
                            }
                            // is it next week?
                            else if (appointmentDate <= nextWeekEnd)
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
                        // check if this patient has an appointment
                        if (!patientHasFutureAppointment)
                        {
                            addTodoToArray(Todo.createSetPatientAppointment(patient), $scope.lowPriorityTodos);
                        }
                    }
                });

                callback();
            },
            function(error)
            {
                $scope.errorHandler.handleError('read active patients', error);
                callback(error);
            }
        );
    }

    function loadInactivePatients(callback)
    {
        // get all inactive patients and check for debt
        Patient.query({status: 'inactive',
                select: 'name debt'},
            function(patients)
            {
                patients.forEach(function(patient)
                {
                    checkPatientDebtAndCreateTodo(patient);
                });

                callback();
            },
            function(error)
            {
                $scope.errorHandler.handleError('read inactive patients', error);
                callback(error);
            });
    }

    function loadIncompleteTodos(callback)
    {
        // get all incomplete todos
        Todo.resource.query({complete: 'false'},
            function(todos)
            {
                todos.forEach(function(todo)
                {
                    addCustomTodo(todo);
                });

                callback();
            },
            function(error)
            {
                $scope.errorHandler.handleError('read todos', error);
                callback(error);
            });
    }

    function loadPatientsWithRecentAppointments(callback)
    {
        // appointment started ~4 hours ago until know
        appointmentsFrom = Date.now() - (4 * 60 * 60 * 1000);
        appointmentsTo = Date.now();

        // get all inactive patients and check for debt
        Patient.query({'appointmentsBetween': '[' + appointmentsFrom + ', ' + appointmentsTo + ']',
                select: '-appointments -payments'},
            function(patients)
            {
                $scope.patientsWithRecentAppointments = [];

                patients.forEach(function(patient)
                {
                    if (patient.debt.total)
                        $scope.patientsWithRecentAppointments.push(patient);
                });

                if (callback) callback();
            },
            function(error)
            {
                $scope.errorHandler.handleError('read patients with recent appointments', error);
                if (callback) callback(error);
            });
    }

    // requires two queries
    async.parallel(
        [
            loadActivePatients,
            loadInactivePatients,
            loadIncompleteTodos,
            loadPatientsWithRecentAppointments
        ],
        function()
        {
            $scope.loading = false;
        }
    );
}]);
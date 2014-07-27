angular.module('tms.todo.services',
[
    'ngResource',
    'tms.patient.services',
    'tms.appointment.services',
    'tms.payment.services'
])

.factory('Todo', ['$resource', '$location', 'Appointment', 'Payment', 'Patient',
         function($resource, $location, Appointment, Payment, Patient)
{
    //
    // A todo resource, mapped to the backend
    //

    var todoResource = $resource('api/todos/:id', {},
        {
            update: {method:'PUT'}
        });

    //
    // A summary is required for a patient
    //
    function SummarizeAppointmentTodo(patient, appointment)
    {
        this.patient = patient;
        this.appointment = appointment;
        this.done = false;
    }

    SummarizeAppointmentTodo.prototype.importance = function() { return 0; }

    SummarizeAppointmentTodo.prototype.complete = function(callback)
    {
        Appointment.update({patientId: this.patient._id, id: this.appointment._id}, {summarySent: true}, function(appointment)
        {
            if (callback) callback();
        });
    }

    SummarizeAppointmentTodo.prototype.view = function(callback)
    {
        $location.path('patients/' + this.patient._id);
    }

    SummarizeAppointmentTodo.prototype.toString = function()
    {
        // get how long ago this appointment was
        function getTimeSinceAppointment(appointment)
        {
            hoursSinceAppointment = (Date.now() - Date.parse(appointment.when)) / (60 * 60 * 1000);

            if (hoursSinceAppointment == 0)
                return "עכשיו";
            else if (hoursSinceAppointment < 24)
                return "היום";
            else if (hoursSinceAppointment < 48)
                return "אתמול";
            else
                return "לפני " + Math.round(hoursSinceAppointment / 24) + " ימים";
        }

        return "לסכם פגישה של " + this.patient.name + " מ" + getTimeSinceAppointment(this.appointment);
    }

    //
    // A debt needs to be collected for a patient
    //
    function CollectDebtTodo(patient, debt)
    {
        this.patient = patient;
        this.debt = debt;
        this.done = false;
    }

    CollectDebtTodo.prototype.importance = function() { return 100; }

    CollectDebtTodo.prototype.view = function(callback)
    {
        $location.path('patients/' + this.patient._id);
    }

    CollectDebtTodo.prototype.toString = function()
    {
        function getDaysSinceOldestUnpaidAppointment(debt)
        {
            return Math.floor((Date.now() - Date.parse(debt.oldestNonPaidAppointment)) / (24 * 60 * 60 * 1000));
        }

        return "לגבות חוב על סך " + this.debt.total + ' ש"ח מ' + this.patient.name;
    }

    //
    // An active patient needs to be contacted
    //
    function ContactPatientTodo(patient)
    {
        this.patient = patient;
        this.done = false;
    }

    ContactPatientTodo.prototype.importance = function() { return 10; }

    ContactPatientTodo.prototype.complete = function(callback)
    {
        Patient.update({id: this.patient._id}, {lastContact: Date.now()}, function(patient)
        {
            callback();
        });
    }

    ContactPatientTodo.prototype.view = function(callback)
    {
        $location.path('patients/' + this.patient._id);
    }

    ContactPatientTodo.prototype.toString = function()
    {
        function getDaysSinceLastContact(patient)
        {
            return Math.floor((Date.now() - Date.parse(patient.lastContact)) / (24 * 60 * 60 * 1000));
        }

        return "ליצור קשר עם " + this.patient.name;
    }

    //
    // A custom created todo
    //
    function CustomTodo(todo)
    {
        this.todo = todo;
        this.done = false;
    }

    CustomTodo.prototype.importance = function() { return 20; }

    CustomTodo.prototype.complete = function(callback)
    {
        todoResource.update({id: this.todo._id}, {complete: true}, function(todo)
        {
            callback();
        });
    }

    CustomTodo.prototype.toString = function()
    {
        return this.todo.text;
    }

    //
    // A new patient needs to have an appointment
    //
    function SetPatientAppointment(patient)
    {
        this.patient = patient;
        this.done = false;
    }

    SetPatientAppointment.prototype.importance = function() { return 5; }

    SetPatientAppointment.prototype.view = function(callback)
    {
        $location.path('patients/' + this.patient._id);
    }

    SetPatientAppointment.prototype.toString = function()
    {
        return "לתאם פגישה עם " + this.patient.name;
    }

    //
    // Factory object
    //
    return {
        createSummarizeAppointmentTodo: function(patient, appointment) { return new SummarizeAppointmentTodo(patient, appointment); },
        createCollectDebtTodo: function(patient, debt) { return new CollectDebtTodo(patient, debt); },
        createContactPatientTodo: function(patient) { return new ContactPatientTodo(patient); },
        createSetPatientAppointment: function(patient) { return new SetPatientAppointment(patient); },
        createCustomTodo: function(todo) { return new CustomTodo(todo); },
        resource: todoResource
    }
}])
.service('TodoModal', ['$modal', function($modal)
{
    function openModal(mode, todo)
    {
        return $modal.open({templateUrl: './partials/todo-modal',
            controller: 'TodoModalController',
            windowClass: 'todo',
            size: 'md',
            resolve:
            {
                todo: function() {return todo;},
                mode: function() {return mode;}
            }});
    }

    this.create = function(successCallback, errorCallback)
    {
        // build the default todo
        todo = {
            text: '',
            type: 'urgent'
        };

        // pop up the modal
        todoModal = openModal('create', todo);

        todoModal.result.then(function(result)
        {
            successCallback(result.updatedTodo);
        });
    }
}]);



class BaseError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        Error.captureStackTrace(this, this.constructor);
    }
}

class SubscriberNotFoundError extends Error {
    constructor(message = 'Subscriber not found') {
        super(message);
        this.name = 'SubscriberNotFoundError';
        this.status = 404;
    }
}

class SubscriberValidationError extends Error {
    constructor(message = 'Invalid subscriber data') {
        super(message);
        this.name = 'SubscriberValidationError';
        this.status = 400;
    }
}

class SubscriberAuthorizationError extends Error {
    constructor(message = 'Not authorized to perform this action on the subscriber') {
        super(message);
        this.name = 'SubscriberAuthorizationError';
        this.status = 403;
    }
}

class DuplicateSubscriberError extends Error {
    constructor(message = 'Subscriber already exists') {
        super(message);
        this.name = 'DuplicateSubscriberError';
        this.status = 409;
    }
}

class DatabaseError extends BaseError {
    constructor(message = 'Database operation failed') {
        super(message, 500);
    }
}

module.exports = {
    SubscriberNotFoundError,
    SubscriberValidationError,
    SubscriberAuthorizationError,
    DuplicateSubscriberError,
    DatabaseError
};
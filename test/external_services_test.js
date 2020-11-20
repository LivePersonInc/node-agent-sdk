'use strict';
const expect = require('chai').expect;
const external = require('../lib/ExternalServices');
const { SERVICES } = require('../lib/Const');

describe('External Services', () => {
    it('compileError: get SDKError from response', (done) => {
        const response = {
            statusMessage: 'Unauthorized',
            statusCode: 401
        };

        const baseMesage = 'Some error';

        const error = external.compileError(baseMesage, null, response, null, SERVICES.AUTHENTICATION);
        expect(error.code).to.equal(response.statusCode);
        expect(error.message).to.equal(`${baseMesage}: ${response.statusMessage}`);
        expect(error.service).to.equal(SERVICES.AUTHENTICATION);
        done();
    });

    it('compileError: get SDKError from body', (done) => {
        const body = {
            error: {
                statusMessage: 'Unauthorized',
                internalCode: 401
            }
        };

        const baseMesage = 'Some error';

        const error = external.compileError(baseMesage, null, null, body, SERVICES.AUTHENTICATION);
        expect(error.code).to.equal(body.error.internalCode);
        expect(error.message).to.equal(`${baseMesage}: ${JSON.stringify(body.error)}`);
        done();
    });

    it('compileError: get SDKError from error', (done) => {
        const error = new Error('Some error');

        const baseMesage = 'Some error';

        const actualError = external.compileError(baseMesage, error, null, null, SERVICES.AUTHENTICATION);
        expect(actualError.code).to.equal(null);
        expect(actualError.message).to.equal(`${baseMesage}: ${error.message}`);
        expect(actualError.error).to.equal(error);
        done();
    });

    it('compileError: when no condition is met', (done) => {
        const response = {
            statusMessage: 'Unauthorized',
            statusCode: 201
        };
        const body = {
            message: 'some body'
        };
        const baseMesage = 'Some error';

        const actualError = external.compileError(baseMesage, null, response, body, SERVICES.AUTHENTICATION);
        expect(actualError).to.equal(null);
        done();
    })
});

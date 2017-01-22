const expect = require('chai').expect;
const mockery = require('mockery');
const sinon = require('sinon');
const Events = require('events');

describe('Agent SDK Tests', () => {

    let tranportSendStub;
    let externalServices;
    let Agent;

    before(() => {
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            useCleanCache: true
        });

        tranportSendStub = sinon.stub();

        class Transport extends Events {
            constructor(conf) {
                super();
                this.send = tranportSendStub;

                setTimeout(() => {
                    this.emit('open', conf);
                }, 10);
            }
        }

        externalServices = {getDomains: sinon.stub(), login: sinon.stub()};
        mockery.registerMock('./Transport', Transport);
        mockery.registerMock('./ExternalServices', externalServices);
        Agent = require('./../lib/AgentSDK');
    });

    after(() => {
        mockery.disable();
    });

    it('should create an instance and publish connected event', done => {
        externalServices.getDomains.yieldsAsync(null, {agentVep: 'some-domain', asyncMessaging: 'another-domain'});
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });
        agent.on('connected', msg => {
            expect(agent.getClock).to.be.a.function;
            expect(agent.agentId).to.equal('account.imauser');
            expect(agent.connected).to.be.true;
            done();
        });
    });

    it('should fail to create an instance when csds is not available', done => {
        externalServices.getDomains.yieldsAsync(new Error('cannot connect to csds'));
        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });
        agent.on('error', err => {
            expect(err).to.be.instanceof(Error);
            expect(err.message).to.contain('csds');
            done();
        });
    });

    it('should fail to create an instance when login service is not available', done => {
        externalServices.getDomains.yieldsAsync(null, {agentVep: 'some-domain', asyncMessaging: 'another-domain'});
        externalServices.login.yieldsAsync(new Error('cannot login'));
        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });
        agent.on('error', err => {
            expect(err).to.be.instanceof(Error);
            expect(err.message).to.contain('login');
            done();
        });
    });

    it('should receive all notifications', done => {
        externalServices.getDomains.yieldsAsync(null, {agentVep: 'some-domain', asyncMessaging: 'another-domain'});
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });
        agent.on('connected', msg => {
            agent.transport.emit('message', {kind: 'notification', type: 'myType', body: {x: 'x'}});
        });

        agent.on('notification', msg => {
            expect(msg).to.be.defined;
            expect(msg.body.x).to.equal('x');
            done();
        });
    });

    it('should receive specific notifications', done => {
        externalServices.getDomains.yieldsAsync(null, {agentVep: 'some-domain', asyncMessaging: 'another-domain'});
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });
        agent.on('connected', msg => {
            agent.transport.emit('message', {kind: 'notification', type: 'myType', body: {x: 'x'}});
        });

        agent.on('myType', body => {
            expect(body).to.be.defined;
            expect(body.x).to.equal('x');
            done();
        });
    });

    it('should call the request callback on response', done => {
        externalServices.getDomains.yieldsAsync(null, {agentVep: 'some-domain', asyncMessaging: 'another-domain'});
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });

        agent.on('connected', msg => {
            agent.getClock({some: 'data'}, (err, response) => {
                expect(err).to.be.null;
                expect(response).to.be.defined;
                expect(response.x).to.equal('x');
                done();
            });

            setTimeout(() => {
                agent.transport.emit('message', {
                    kind: 'resp',
                    reqId: tranportSendStub.getCall(0).args[0].id,
                    type: 'myRespType',
                    body: {x: 'x'}
                });
            }, 10);
        });

    });

    it('should emit specific response event', done => {
        externalServices.getDomains.yieldsAsync(null, {agentVep: 'some-domain', asyncMessaging: 'another-domain'});
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });

        agent.on('connected', msg => {
            agent.getClock({some: 'data'}, response => {});

            setTimeout(() => {
                agent.transport.emit('message', {
                    kind: 'resp',
                    reqId: tranportSendStub.getCall(1).args[0].id,
                    type: 'myRespType',
                    body: {x: 'x'}
                });
            }, 10);
        });

        agent.on('myRespType', body => {
            expect(body).to.be.defined;
            expect(body.x).to.equal('x');
            done();
        });
    });

    it('should call the request callback with error on timeout', done => {
        externalServices.getDomains.yieldsAsync(null, {agentVep: 'some-domain', asyncMessaging: 'another-domain'});
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password',
            requestTimeout: 10,
            errorCheckInterval: 10,
        });

        agent.on('connected', msg => {
            agent.getClock({some: 'data'}, (err, response) => {
                expect(err).to.be.defined;
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.contain('timed');
                done();
            });
        });

    });

});

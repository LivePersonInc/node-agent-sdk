const expect = require('chai').expect;
const mockery = require('mockery');
const sinon = require('sinon');
const Events = require('events');

describe('Agent SDK Tests', function () {

    let tranportSendStub;
    let externalServices;
    let Agent;

    before(function () {
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

    after(function () {
        mockery.disable();
    });

    it('happy flow of initialization should work', function (done) {
        externalServices.getDomains.yieldsAsync(null, {agentVep: 'some-domain', asyncMessaging: 'another-domain'});
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });
        agent.on('connected', (msg) => {
            expect(agent.getClock).to.be.a.function;
            expect(agent.agentId).to.equal('account.imauser');
            expect(agent.connected).to.be.true;
            done();
        });
    });

});

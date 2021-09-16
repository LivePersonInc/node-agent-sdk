'use strict';
const expect = require('chai').expect;
const mockery = require('mockery');
const sinon = require('sinon');
const external = require('../lib/ExternalServices');
const Events = require('events');
const fs = require('fs');

describe('Agent SDK Tests', () => {

    let tranportSendStub;
    let externalServices;
    let requestCSDSStub;
    let Agent;
    const csdsResponse = {
        baseURIs: [{service: 'agentVep', baseURI: 'some-domain'}, {
            service: 'asyncMessaging',
            baseURI: 'another-domain'
        }]
    };

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
                this.configuration = { token: null };
                this.send = tranportSendStub;

                setImmediate(() => {
                    this.emit('open', conf);
                });
            }

            reconnect() {

            }

            close() {

            }
        }

        externalServices = {
            getDomains: sinon.stub(),
            login: sinon.stub(),
            getAgentId: sinon.stub(),
            refreshSession: sinon.stub(),
            compileError: external.compileError
        };
        requestCSDSStub = sinon.stub();
        mockery.registerMock('./Transport', Transport);
        mockery.registerMock('./ExternalServices', externalServices);
        mockery.registerMock('request', requestCSDSStub);
        Agent = require('./../lib/AgentSDK');
    });

    after(() => {
        mockery.disable();
    });

    // this is causing an error in qa
    it('undefined domain reponse', done => {
        requestCSDSStub.yieldsAsync(null, {}, undefined);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        externalServices.getAgentId.yieldsAsync(null, {pid: 'someId'});
        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });

        agent.on('error', err => {
            expect(err.message).to.equal('could not fetch domains');
            agent.dispose();
            done();
        });
    });

    it('should create an instance and publish connected event', done => {
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        externalServices.getAgentId.yieldsAsync(null, {pid: 'someId'});
        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });
        agent.on('connected', msg => {
            expect(agent.getClock).to.be.a('function');
            // expect(agent.agentId).to.equal('account.imauser');
            expect(agent.connected).to.be.true;
            done();
        });
    });

    it('getBearerToken: should be able to get a token after agent is connected', done => {
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        const loginData = {bearer: 'im encrypted', csrf: 'someCsrf', config: {userId: 'imauser'}};
        externalServices.login.yieldsAsync(null, loginData);
        externalServices.getAgentId.yieldsAsync(null, {pid: 'someId'});
        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });
        agent.on('connected', () => {
            expect(agent.getBearerToken()).to.equal(loginData.bearer);
            agent.dispose();
            done();
        });
    });

    it('should emit an error if userId is undefined', done => {
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {}, accountData:'NO'});
        externalServices.getAgentId.yieldsAsync(null, {pid: 'someId'});
        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });
        agent.on('connected', msg => {
            throw new Error('connected event received invalidly');
        });

        agent.on('error', (err) => {
            // err.message = invalid login state, userId is undefined
            expect(err.message).to.equal('invalid login state, userId is undefined');
            done();
        });
    });

    it('should fail to create an instance when csds is not available', done => {
        requestCSDSStub.yieldsAsync(new Error('cannot connect to csds'));

        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });
        agent.on('error', err => {
            expect(err).to.be.instanceof(Error);
            expect(err.message).to.equal('Error on CSDS request: cannot connect to csds');
            done();
        });
    });

    // it('should fail to create an instance when cannot get agent id', done => {
    //     requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
    //     externalServices.getAgentId.yieldsAsync(new Error('cannot get agent id'));
    //
    //     const agent = new Agent({
    //         accountId: 'account',
    //         username: 'me',
    //         password: 'password'
    //     });
    //     agent.on('error', err => {
    //         expect(err).to.be.instanceof(Error);
    //         expect(err.message).to.contain('agent');
    //         done();
    //     });
    // });

    it('should fail to create an instance when login service is not available', done => {
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(new Error('cannot login'));
        externalServices.getAgentId.yieldsAsync(null, {pid: 'someId'});
        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });
        agent.on('error', err => {
            expect(err).to.be.instanceof(Error);
            expect(err.message).to.contain('cannot login');
            done();
        });
    });

    it('should receive all notifications', done => {
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        externalServices.getAgentId.yieldsAsync(null, {pid: 'someId'});

        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });
        agent.on('connected', msg => {
            agent.transport.emit('message', {kind: 'notification', type: 'myType', body: {x: 'x'}});
        });

        agent.on('notification', msg => {
            expect(msg).to.not.be.undefined;
            expect(msg.body.x).to.equal('x');
            done();
        });
    });

    it('should receive all notifications using assertion', done => {
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        externalServices.getAgentId.yieldsAsync(null, {pid: 'someId'});

        const agent = new Agent({
            accountId: 'account',
            assertion: 'some SAML assertion',
        });
        agent.on('connected', msg => {
            agent.transport.emit('message', {kind: 'notification', type: 'myType', body: {x: 'x'}});
        });

        agent.on('notification', msg => {
            expect(msg).to.not.be.undefined;
            expect(msg.body.x).to.equal('x');
            done();
        });
    });

    it('should receive all notifications using oauth1', done => {
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        externalServices.getAgentId.yieldsAsync(null, {pid: 'someId'});

        const agent = new Agent({
            accountId: 'account',
            username: 'reem1',
            appKey: 'ad377dbbb8204f1c8dbd57a3409a1b14',
            secret: '19e5dbabfd09a5ac',
            accessToken: '00f49175a1eb4f9088e3c4ea822d9dbd',
            accessTokenSecret: '4dac3a709ff23e7b',
        });
        agent.on('connected', msg => {
            agent.transport.emit('message', {kind: 'notification', type: 'myType', body: {x: 'x'}});
        });

        agent.on('notification', msg => {
            expect(msg).to.not.be.undefined;
            expect(msg.body.x).to.equal('x');
            done();
        });
    });

    it('should receive all notifications using token', done => {
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        externalServices.getAgentId.yieldsAsync(null, {pid: 'someId'});

        const agent = new Agent({
            accountId: 'account',
            token: 'my token',
            userId: 'myId'
        });
        agent.on('connected', msg => {
            agent.transport.emit('message', {kind: 'notification', type: 'myType', body: {x: 'x'}});
        });

        agent.on('notification', msg => {
            expect(msg).to.not.be.undefined;
            expect(msg.body.x).to.equal('x');
            done();
        });
    });

    it('should receive specific notifications', done => {
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        externalServices.getAgentId.yieldsAsync(null, {pid: 'someId'});

        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });
        agent.on('connected', msg => {
            agent.transport.emit('message', {kind: 'notification', type: 'myType', body: {x: 'x'}});
        });

        agent.on('myType', body => {
            expect(body).to.not.be.undefined;
            expect(body.x).to.equal('x');
            done();
        });
    });

    it('reconnect: should only connect to WS when flag is true', (done) => {
        // Let:
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        externalServices.refreshSession.yieldsAsync(null, {});
        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });

        agent.on('connected', () => {
            // If:
            const reconnectSpy = sinon.spy(agent.transport, 'reconnect');
            agent.reconnect(true);

            // Then:
            expect(reconnectSpy.calledOnce).to.be.ok;
            done();
        });
    });

    it('reconnect: should re-login and re-connect WS when flag is false', (done) => {
        // Let:
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        externalServices.refreshSession.yieldsAsync(null, {});
        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });

        // If:
        agent.on('connected', () => {
            agent.reconnect(false);
            done();
        });

        // Then:
        agent.on('success', (context) => {
            if (context && context.location) {
                expect(context.location).to.be.oneOf(['Connect#CSDS', 'Connect#Login', 'Reconnect#CSDS', 'Reconnect#Relogin#WS']);
            }
        });
    });

    it('reconnect: should skip re-login and re-connect WS when there is a CSDS failure', (done) => {
        // Let:
        requestCSDSStub.yieldsAsync(new Error('cannot fetch CSDS domains'));
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        externalServices.refreshSession.yieldsAsync(null, {});
        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });

        // If:
        agent.reconnect(false);

        // Then:
        agent.on('error', (err, context) => {
            if (context && context.location) {
                expect(context.location).to.be.oneOf(['Connect#CSDS', 'Reconnect#CSDS']);
            }
        });
        done();
    });



    it('refreshSession: failed to connect to CSDS. Should fail with callback error', done => {
        // Let:
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', csrf: 'someCSRF', config: {userId: 'imauser'}}, 'cookies');
        externalServices.refreshSession.yieldsAsync(null, {});

        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });

        // If:
        agent.on('connected', () => {
            requestCSDSStub.yieldsAsync(new Error('cannot connect to csds'));
            // clear CSDS cache
            agent.csdsClient.cache.flushAll();
            agent.refreshSession((err) => {
                // Then:
                // Propagate CSDS error
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.equal('Error on CSDS request: cannot connect to csds');
                agent.dispose();
                done();
            });
        });

        agent.on('error', (error, context) => {
            // Then:
            if (context && context.location) {
                expect(context.location).to.be.equal('RefreshSession#CSDS');
            }
        })
    });


    it('refreshSession: failed to refresh session. Should fail with callback error', done => {
        // Let:
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', csrf: 'someCSRF', config: {userId: 'imauser'}}, 'cookies');
        externalServices.refreshSession.yieldsAsync(new Error('Failed to connect to agentVEP'));

        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });

        // If:
        agent.on('connected', () => {
            agent.refreshSession((err) => {
                // Then:
                // Propagate refreshSession error
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.equal('Failed to connect to agentVEP');
                agent.dispose();
                done();
            });
        });

        agent.on('error', (error, context) => {
            // Then:
            if (context && context.location) {
                expect(context.location).to.equal('RefreshSession#REST');
                expect(context.location).to.not.equal('RefreshSession#CSDS');
                expect(context.location).to.not.equal('RefreshSession#Relogin#WS');
            }
        })
    });

    it('refreshSession: failed to refresh session with 401. Should succeed during re-login', done => {
        // Let:
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', csrf: 'someCSRF', config: {userId: 'imauser'}}, 'cookies');
        const error = new Error('Unauthorized agentVEP refresh');
        error.code = 401;
        externalServices.refreshSession.yieldsAsync(error);

        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });

        // If:
        agent.on('connected', () => {
            agent.refreshSession((err) => {
                // Then:
                // Should be successful with re-login
                expect(err).to.equal(null);
                agent.dispose();
                done();
            });
        });

        agent.on('error', (error, context) => {
            if (context && context.location) {
                // Then:
                expect(context.location).to.equal('RefreshSession#REST');
                expect(context.location).to.not.equal('RefreshSession#CSDS');
                expect(context.location).to.not.equal('RefreshSession#Relogin#WS');
            }
        })
    });

    it('refreshSession: failed to refresh session with 401, failed to re-login. Should fail with callback error', done => {
        // Let:
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', csrf: 'someCSRF', config: {userId: 'imauser'}}, 'cookies');
        const error = new Error('Unauthorized agentVEP refresh');
        error.code = 401;
        externalServices.refreshSession.yieldsAsync(error);

        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });


        // Then:
        agent.on('connected', () => {
            externalServices.login.yieldsAsync(new Error('Failed to login'));
            agent.refreshSession((err) => {
                // Should be successful with re-login
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.equal('Failed to login');
                agent.dispose();
                done();
            });
        });

        agent.on('error', (error, context) => {
            if (context && context.location) {
                expect(context.location).to.be.oneOf(['Connect#Login', 'RefreshSession#Relogin#WS', 'RefreshSession#REST'])
                expect(context.location).to.not.equal('RefreshSession#CSDS');
            }
        })
    });

    it('refreshSession: should call refreshSessionFlow successfully', done => {
        // Let:
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', csrf: 'someCSRF', config: {userId: 'imauser'}}, 'cookies');
        externalServices.refreshSession.yieldsAsync(null, {});

        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });

        // If:
        agent.on('connected', () => {
            agent.refreshSession((err) => {
                // Then:
                // Successful handleRefreshSessionFlow
                expect(err).to.equal(null);
                agent.dispose();
                done();
            });
        });

        agent.on('success', (context) => {
            if (context && context.location) {
                expect(context.location).to.be.oneOf(['Connect#CSDS', 'Connect#Login', 'RefreshSession#Precheck', 'RefreshSession#Relogin#WS', 'RefreshSession#REST', 'RefreshSession#CSDS']);
            }
        })
    });

    it('refreshSession: should fail through pre-checks when csrf and jar are not defined', done => {
        // Let:
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        externalServices.refreshSession.yieldsAsync(null, {});

        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });

        // If:
        agent.on('connected', () => {
            agent.refreshSession((err) => {
                // Then:
                // Successful handleRefreshSessionFlow
                expect(err).to.be.instanceOf(Error);
                expect(err.message).to.equal('CSRF and JAR are not defined for this agent. Please reconnect with bearer token.');
                agent.dispose();
                done();
            });
        });

        agent.on('error', (error, context) => {
            if (context && context.location) {
                expect(context.location).to.equal('RefreshSession#Precheck');
            }
        })
    });

    it('should call the request callback on response', done => {
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        externalServices.getAgentId.yieldsAsync(null, {pid: 'someId'});

        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });

        agent.on('connected', msg => {
            agent.getClock({some: 'data'}, (err, response) => {
                expect(err).to.be.null;
                expect(response).to.not.be.undefined;
                expect(response.x).to.equal('x');
                done();
            });

            setImmediate(() => {
                agent.transport.emit('message', {
                    kind: 'resp',
                    reqId: tranportSendStub.getCall(0).args[0].id,
                    type: 'myRespType',
                    body: {x: 'x'}
                });
            });
        });

    });

    it('should emit specific response event', done => {
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        externalServices.getAgentId.yieldsAsync(null, {pid: 'someId'});

        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });

        agent.on('connected', msg => {
            agent.getClock({some: 'data'}, response => {
            });

            setImmediate(() => {
                agent.transport.emit('message', {
                    kind: 'resp',
                    reqId: tranportSendStub.getCall(1).args[0].id,
                    type: 'myRespType',
                    body: {x: 'x'}
                });
            });
        });

        agent.on('myRespType', body => {
            expect(body).to.not.be.undefined;
            expect(body.x).to.equal('x');
            done();
        });
    });

    it('should call the request callback with error on timeout', done => {
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        externalServices.getAgentId.yieldsAsync(null, {pid: 'someId'});

        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password',
            requestTimeout: 10,
            errorCheckInterval: 10,
        });

        agent.on('connected', msg => {
            agent.getClock({some: 'data'}, (err, response) => {
                expect(err).to.not.be.undefined;
                expect(err).to.be.instanceof(Error);
                expect(err.message).to.contain('timed');
                done();
            });
        });

    });

    it('should dispose correctly', done => {
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        externalServices.getAgentId.yieldsAsync(null, {pid: 'someId'});

        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password',
            requestTimeout: 10,
            errorCheckInterval: 10,
        });

        agent.on('connected', msg => {
            agent.dispose();
            expect(agent.transport).to.be.null;
            done();
        });

    });

    it('Should emit a warn (and no error) when a notification with partial participantsPId data is received', done => {
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        externalServices.getAgentId.yieldsAsync(null, {pid: 'someId'});
        const change =  {'type':'UPSERT','result':{'convId':'38c1ff4b-24e5-2342-8d05-15a62de2daad','effectiveTTR':-1,'conversationDetails':{'convId':'38c1ff4b-24e5-2342-8d05-15a62de2daad','skillId':'1251428632','participants':{'CONSUMER':['102f83624a545696f5dd87ecdd6edf394430f3445666ba68b533c847abb11'],'MANAGER':['2344566.1282051932','2344566.901083232'],'CONTROLLER':['2344566.1257599432'],'READER':[]},'participantsPId':{'CONSUMER':['102f83624a545696f5dd87ecdd6edf394430f3445666ba68b533c847abb11'],'MANAGER':['f675416a-7d5a-5d06-a7bd-bdf5fcc426a1','8ffebb81-0614-568c-a011-3b17eafc5b9d'],'READER':[]},'dialogs':[{'dialogId':'5Yn6I7hpR6C3JWg4YT-Meg','participantsDetails':[{'id':'102f83624a545696f5dd87ecdd6edf394430f3445666ba68b533c847abb11','role':'CONSUMER','state':'ACTIVE'}],'dialogType':'POST_SURVEY','channelType':'MESSAGING','metaData':{'appInstallId':'896ef5ea-b954-42c9-91b7-a9134a47faa7'},'state':'OPEN','creationTs':1564734095888,'metaDataLastUpdateTs':1564734095887},{'dialogId':'38c1ff4b-24e5-2342-8d05-15a62de2daad','participantsDetails':[{'id':'102f83624a545696f5dd87ecdd6edf394430f3445666ba68b533c847abb11','role':'CONSUMER','state':'ACTIVE'},{'id':'2344566.1282051932','role':'MANAGER','state':'ACTIVE'},{'id':'2344566.1257599432','role':'CONTROLLER','state':'ACTIVE'},{'id':'2344566.901083232','role':'MANAGER','state':'ACTIVE'}],'dialogType':'MAIN','channelType':'MESSAGING','state':'CLOSE','creationTs':1564685380489,'endTs':1564734095888,'metaDataLastUpdateTs':1564734095888,'closedBy':'AGENT'}],'brandId':'2344566','state':'CLOSE','stage':'OPEN','closeReason':'AGENT','startTs':1564685380489,'metaDataLastUpdateTs':1564734095888,'firstConversation':false,'csatRate':0,'ttr':{'ttrType':'NORMAL','value':1200},'note':'','context':{'type':'CustomContext','clientProperties':{'type':'.ClientProperties','appId':'whatsapp','ipAddress':'10.42.138.108','features':['PHOTO_SHARING','QUICK_REPLIES','AUTO_MESSAGES','MULTI_DIALOG','FILE_SHARING','RICH_CONTENT']},'name':'WhatsApp Business'},'conversationHandlerDetails':{'accountId':'2344566','skillId':'1251428632'}},'numberOfunreadMessages':{'102f83624a545696f5dd87ecdd6edf394430f3445666ba68b533c847abb11':1,'2344566.901083232':0,'2344566.1282051932':10},'lastUpdateTime':1564734095888}};

        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });

        let warned = false;
        let errReceived = false;

        agent.on('connected', msg => {
            agent.transport.emit('message', {kind: 'notification', type: '.ams.aam.ExConversationChangeNotification', body: { changes:[change]}});
        });

        agent.on('warn', msg => {
            expect(msg).to.not.be.undefined;
            expect(msg.message).to.contain('invalid participant on conversation');
            warned = true;
        });

        agent.on('error', err => {
            errReceived = true;
        });

        agent.on('notification', msg => {
            expect(msg).to.not.be.undefined;
            expect(msg.body.changes[0].result.conversationDetails.participants.length).to.equal(3);
            expect(warned).to.equal(true);
            expect(errReceived).to.equal(false);
            done();
        });

    });

    it('Should handle suggested participant (no PId entry) without error or warn', done => {
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        externalServices.getAgentId.yieldsAsync(null, {pid: 'someId'});
        const change = JSON.parse(fs.readFileSync(__dirname + '/TransformError1.json').toString());
        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });

        let warned = false;
        let errReceived = false;

        agent.on('connected', msg => {
            agent.transport.emit('message', {kind: 'notification', type: '.ams.aam.ExConversationChangeNotification', body: { changes:[change]}});
        });

        agent.on('warn', msg => {
            expect(msg).to.be.defined;
            expect(msg.message).to.contain('Invalid participant on conversation');
            warned = true;
        });

        agent.on('error', err => {
            errReceived = true;
        });

        agent.on('notification', msg => {
            expect(msg).to.not.be.undefined;
            expect(msg.body.changes[0].result.conversationDetails.participants.length).to.equal(5);
            expect(warned).to.equal(false);
            expect(errReceived).to.equal(false);
            done();
        });

    });

    it('Should emit a TransformError when a notification with no participantsPId is received', done => {
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        externalServices.getAgentId.yieldsAsync(null, {pid: 'someId'});
        const change =  {'type':'UPSERT','result':{'convId':'38c1ff4b-24e5-2342-8d05-15a62de2daad','effectiveTTR':-1,'conversationDetails':{'convId':'38c1ff4b-24e5-2342-8d05-15a62de2daad','skillId':'1251428632','participants':{'CONSUMER':['102f83624a545696f5dd87ecdd6edf394430f3445666ba68b533c847abb11'],'MANAGER':['2344566.1282051932','2344566.901083232'],'CONTROLLER':['2344566.1257599432'],'READER':[]},'dialogs':[{'dialogId':'5Yn6I7hpR6C3JWg4YT-Meg','participantsDetails':[{'id':'102f83624a545696f5dd87ecdd6edf394430f3445666ba68b533c847abb11','role':'CONSUMER','state':'ACTIVE'}],'dialogType':'POST_SURVEY','channelType':'MESSAGING','metaData':{'appInstallId':'896ef5ea-b954-42c9-91b7-a9134a47faa7'},'state':'OPEN','creationTs':1564734095888,'metaDataLastUpdateTs':1564734095887},{'dialogId':'38c1ff4b-24e5-2342-8d05-15a62de2daad','participantsDetails':[{'id':'102f83624a545696f5dd87ecdd6edf394430f3445666ba68b533c847abb11','role':'CONSUMER','state':'ACTIVE'},{'id':'2344566.1282051932','role':'MANAGER','state':'ACTIVE'},{'id':'2344566.1257599432','role':'CONTROLLER','state':'ACTIVE'},{'id':'2344566.901083232','role':'MANAGER','state':'ACTIVE'}],'dialogType':'MAIN','channelType':'MESSAGING','state':'CLOSE','creationTs':1564685380489,'endTs':1564734095888,'metaDataLastUpdateTs':1564734095888,'closedBy':'AGENT'}],'brandId':'2344566','state':'CLOSE','stage':'OPEN','closeReason':'AGENT','startTs':1564685380489,'metaDataLastUpdateTs':1564734095888,'firstConversation':false,'csatRate':0,'ttr':{'ttrType':'NORMAL','value':1200},'note':'','context':{'type':'CustomContext','clientProperties':{'type':'.ClientProperties','appId':'whatsapp','ipAddress':'10.42.138.108','features':['PHOTO_SHARING','QUICK_REPLIES','AUTO_MESSAGES','MULTI_DIALOG','FILE_SHARING','RICH_CONTENT']},'name':'WhatsApp Business'},'conversationHandlerDetails':{'accountId':'2344566','skillId':'1251428632'}},'numberOfunreadMessages':{'102f83624a545696f5dd87ecdd6edf394430f3445666ba68b533c847abb11':1,'2344566.901083232':0,'2344566.1282051932':10},'lastUpdateTime':1564734095888}};
        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });

        let warned = false;
        let notificationReceived = false;

        agent.on('connected', msg => {
            agent.transport.emit('message', {kind: 'notification', type: '.ams.aam.ExConversationChangeNotification', body: { changes:[change]}});
        });

        agent.on('warn', msg => {
            warned = true;
        });

        agent.on('notification', msg => {
            notificationReceived = true;
        });

        agent.on('error', err => {
            setTimeout(() => {
                expect(err).to.not.be.undefined;
                expect(warned).to.equal(false);
                expect(notificationReceived).to.equal(false);
                done();
            }, 100);
        });

    });

    it('Should include brandId in the message', done => {
        requestCSDSStub.yieldsAsync(null, {}, csdsResponse);
        externalServices.login.yieldsAsync(null, {bearer: 'im encrypted', config: {userId: 'imauser'}});
        externalServices.getAgentId.yieldsAsync(null, {pid: 'someId'});
        const change =  {'type':'UPSERT','result':{'convId':'38c1ff4b-24e5-2342-8d05-15a62de2daad','effectiveTTR':-1,'conversationDetails':{'convId':'38c1ff4b-24e5-2342-8d05-15a62de2daad','skillId':'1251428632','participants':{'CONSUMER':['102f83624a545696f5dd87ecdd6edf394430f3445666ba68b533c847abb11'],'MANAGER':['2344566.1282051932','2344566.901083232'],'CONTROLLER':['2344566.1257599432'],'READER':[]},'participantsPId':{'CONSUMER':['102f83624a545696f5dd87ecdd6edf394430f3445666ba68b533c847abb11'],'MANAGER':['f675416a-7d5a-5d06-a7bd-bdf5fcc426a1','8ffebb81-0614-568c-a011-3b17eafc5b9d'],'READER':[]},'dialogs':[{'dialogId':'5Yn6I7hpR6C3JWg4YT-Meg','participantsDetails':[{'id':'102f83624a545696f5dd87ecdd6edf394430f3445666ba68b533c847abb11','role':'CONSUMER','state':'ACTIVE'}],'dialogType':'POST_SURVEY','channelType':'MESSAGING','metaData':{'appInstallId':'896ef5ea-b954-42c9-91b7-a9134a47faa7'},'state':'OPEN','creationTs':1564734095888,'metaDataLastUpdateTs':1564734095887},{'dialogId':'38c1ff4b-24e5-2342-8d05-15a62de2daad','participantsDetails':[{'id':'102f83624a545696f5dd87ecdd6edf394430f3445666ba68b533c847abb11','role':'CONSUMER','state':'ACTIVE'},{'id':'2344566.1282051932','role':'MANAGER','state':'ACTIVE'},{'id':'2344566.1257599432','role':'CONTROLLER','state':'ACTIVE'},{'id':'2344566.901083232','role':'MANAGER','state':'ACTIVE'}],'dialogType':'MAIN','channelType':'MESSAGING','state':'CLOSE','creationTs':1564685380489,'endTs':1564734095888,'metaDataLastUpdateTs':1564734095888,'closedBy':'AGENT'}],'brandId':'2344566','state':'CLOSE','stage':'OPEN','closeReason':'AGENT','startTs':1564685380489,'metaDataLastUpdateTs':1564734095888,'firstConversation':false,'csatRate':0,'ttr':{'ttrType':'NORMAL','value':1200},'note':'','context':{'type':'CustomContext','clientProperties':{'type':'.ClientProperties','appId':'whatsapp','ipAddress':'10.42.138.108','features':['PHOTO_SHARING','QUICK_REPLIES','AUTO_MESSAGES','MULTI_DIALOG','FILE_SHARING','RICH_CONTENT']},'name':'WhatsApp Business'},'conversationHandlerDetails':{'accountId':'2344566','skillId':'1251428632'}},'numberOfunreadMessages':{'102f83624a545696f5dd87ecdd6edf394430f3445666ba68b533c847abb11':1,'2344566.901083232':0,'2344566.1282051932':10},'lastUpdateTime':1564734095888}};
        const agent = new Agent({
            accountId: 'account',
            username: 'me',
            password: 'password'
        });

        agent.on('connected', msg => {
            agent.transport.emit('message', {kind: 'notification', type: '.ams.aam.ExConversationChangeNotification', body: { changes:[change]}});
        });


        agent.on('notification', msg => {
            expect(msg).to.not.be.undefined;
            expect(msg.body.changes[0].result.conversationDetails.brandId).to.equal('2344566');
            done();
        });

    });

});

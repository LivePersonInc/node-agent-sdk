'use strict';
const expect = require('chai').expect;
const mockery = require('mockery');
const sinon = require('sinon');
const Events = require('events');

describe('Test Transport.js',()=>{
    const wsConstructorSpy = sinon.stub();
    class Websocket extends Events{
        constructor(){
            super();
            wsConstructorSpy();
        }
        terminate(){

        }
    }
    mockery.enable({
        warnOnReplace: false,
        warnOnUnregistered: false,
        useCleanCache: true
    });
    mockery.registerMock('ws', Websocket);
    const Transport = require('./../lib/Transport');
    let transport;
    beforeEach(()=>{
        wsConstructorSpy.reset();
        transport = new Transport({});
    });

    describe('test initialization', ()=>{

        it('should be listening to all ws events after class initialization', ()=>{
            expect(wsConstructorSpy.calledOnce).to.be.true;
            expect(transport.ws.listenerCount(Transport.WS_EVENTS.OPEN)).to.equal(1);
            expect(transport.ws.listenerCount(Transport.WS_EVENTS.CLOSE)).to.equal(1);
            expect(transport.ws.listenerCount(Transport.WS_EVENTS.ERROR)).to.equal(1);
            expect(transport.ws.listenerCount(Transport.WS_EVENTS.MESSAGE)).to.equal(1);
        });
    });

    describe('test close', ()=>{

        it('should unbind all events and terminate connection and set ws to null', ()=>{
            const terminateSpy = sinon.spy(transport.ws, 'terminate');
            const removeListenerSpy = sinon.spy(transport.ws, 'removeListener');
            transport.close();
            expect(transport.ws).to.be.null;
            expect(terminateSpy.calledOnce).to.be.true;
            expect(removeListenerSpy.callCount).to.equal(4);
            expect(removeListenerSpy.calledWith(Transport.WS_EVENTS.OPEN),transport._onOpen);
            expect(removeListenerSpy.calledWith(Transport.WS_EVENTS.CLOSE),transport._onClose);
            expect(removeListenerSpy.calledWith(Transport.WS_EVENTS.ERROR),transport._onError);
            expect(removeListenerSpy.calledWith(Transport.WS_EVENTS.MESSAGE),transport._onMessage);
        });
    });
    describe('test reconnect', ()=>{

       it('should call close and then create new ws instance', ()=>{
          const closeSpy = sinon.spy(transport, 'close');
          transport.reconnect();
          expect(wsConstructorSpy.calledTwice).to.be.true;
          expect(closeSpy.calledOnce).to.be.true;
       });
    });
});

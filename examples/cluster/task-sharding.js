const Events = require('events');
const HashRing = require('hashring');
const Zoologist = require('zoologist').Zoologist;
const ServiceInstanceBuilder = require('zoologist').ServiceInstanceBuilder;
const ServiceDiscoveryBuilder = require('zoologist').ServiceDiscoveryBuilder;

class TaskSharding extends Events {
    constructor(zkConnectionString, serviceName) {
        super();
        this.serviceName = serviceName || 'my/service/name/v1';
        var zoologistClient = Zoologist.newClient(zkConnectionString);
        zoologistClient.start();
        this.serviceInstance = ServiceInstanceBuilder.builder().name(this.serviceName).build();
        this.serviceDiscovery = ServiceDiscoveryBuilder.builder()
                .client(zoologistClient).basePath('services')
                .thisInstance(this.serviceInstance).build();
        this._onClusterChange((si, hr) => this.emit('clusterChange', si, hr));
    }

    _onClusterChange(cb) {
        const that = this;
        that.serviceDiscovery.registerService((err, data) => {
            get();
            function get() {
                const absPath = [that.serviceDiscovery.basePath, that.serviceName].join('/');
                that.serviceDiscovery.client.getClientwithConnectionCheck().getChildren(absPath, function() {
                    get();
                }, function(err, serviceList, stat) {
                    cb.call(this, that.serviceInstance, new HashRing(serviceList));
                });
            }
        });
    }
}

module.exports = TaskSharding;

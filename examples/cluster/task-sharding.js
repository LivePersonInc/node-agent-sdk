var HashRing = require('hashring');
var Zoologist = require('zoologist').Zoologist;
var ServiceInstanceBuilder = require('zoologist').ServiceInstanceBuilder;
var ServiceDiscoveryBuilder = require('zoologist').ServiceDiscoveryBuilder;

class TaskSharding {
    constructor(zkConnectionString, serviceName) {
        this.serviceName = serviceName || 'my/service/name/v1';
        var zoologistClient = Zoologist.newClient(zkConnectionString);
        zoologistClient.start();
        this.serviceInstance = ServiceInstanceBuilder.builder().name(this.serviceName).build();
        this.serviceDiscovery = ServiceDiscoveryBuilder.builder()
                .client(zoologistClient).basePath('services')
                .thisInstance(this.serviceInstance).build();
    }

    onClusterChange(cb) {
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

module.exports = function (grunt, options) {

    const tasks = ['node_version', 'jshint'];

    // computation...
    return {
        'tasks': ['availabletasks'],
        'default': tasks,
        'test': [
            'node_version',
            'connect',
            'lp_blanket_mocha'
        ]
    };
};

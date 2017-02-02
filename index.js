'use strict';

exports.register = function () {
    let plugin = this;
    plugin.load_recipient-routes_ini();
}

exports.load_recipient-routes_ini = function () {
    let plugin = this;

    plugin.cfg = plugin.config.get('recipient-routes.ini', {
        booleans: [
            '+enabled',               // plugins.cfg.main.enabled=true
            '-disabled',              // plugins.cfg.main.disabled=false
            '+feature_section.yes'    // plugins.cfg.feature_section.yes=true
        ]
    },
    function () {
        plugin.load_example_ini();
    });
}

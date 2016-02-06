/**
 * Created by nafigator on 30.03.2015.
 */

requirejs.config({

    baseUrl: "../",
    paths:{
        underscore: "bower_components/underscore/underscore",
        jquery: "bower_components/jquery/dist/jquery",
        jasmine:  "bower_components/jasmine/lib/jasmine-core/jasmine",
        'jasmine-html': "bower_components/jasmine/lib/jasmine-core/jasmine-html",
        'jasmine-boot': "specs/boot",
        'specs': "./specs"
    },

    shim:{
        jasmine: {
            exports: 'jasmine'
        },

        'jasmine-html': {
            deps:['jasmine'],
            exports: 'jasmine'

        },

        'jasmine-boot': {
            deps:['jasmine-html'],
            exports: 'jasmine'
        }

    }


});

module.exports = function ( grunt ) {
  'use strict';

  grunt.initConfig( {
    pkg : grunt.file.readJSON( 'package.json' ),

    jshint : {
      /* https://github.com/gruntjs/grunt-contrib-jshint */
      all : [
        'Gruntfile.js',
        'index.js'
      ],
      options : {
        jshintrc : '.jshintrc',
      },
    }
  } );

  grunt.loadNpmTasks( 'grunt-contrib-jshint' );

  grunt.registerTask( 'test', ['jshint'] );
};
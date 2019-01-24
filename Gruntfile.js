/**
 * Copyright 2018 British Broadcasting Corporation
 *  
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy
 * of the License at
 *  
 *     http://www.apache.org/licenses/LICENSE-2.0
 *  
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 **/


module.exports = function(grunt) {

  grunt.initConfig({

    clean: {
      dist: "dist",
      build: "build",
      tests: "build/tests",
    },
    
      
    webpack: {
      lib: {
        context: __dirname + "/src/js",
        entry: {
          'dvbcsstv-lib' : ['./main.js']
        },
        output: {
          path: __dirname + "/dist",
          filename: "[name].js",
          chunkFilename: "chunk-[name]-[chunkhash].js",
          library: 'dvbcsstv-lib',
          libraryTarget: 'umd'
        },
        module: {
          loaders: []
        },
        resolve: { root: __dirname + "/src/js" },
      },
      
      specs: {
        context: __dirname + "/tests/js",
        entry: {
          "tests" : "./main.js"
        },
        output: {
          path: __dirname + "/build/tests/",
          filename: "specs.js",
          chunkFilename: "chunk-[name]-[chunkhash].js"
        },
        module: {
          loaders: []
        },
        resolve: {
          root: [ __dirname + "/tests/js/specs", __dirname + "/tests/js/util",  __dirname+"/src/js" ]
        }
      }
    },
    
    jasmine: {
      tests: {
        src: [],  // not needed because each test uses require() to load what it is testing
        options: {
          specs: "build/tests/specs.js",
          outfile: "build/tests/_specRunner.html",
          summary: true,
          keepRunner: true
        }
      }
    },
    
    watch: {
      scripts: {
        files: ['src/js/**/*.js', 'tests/**/*.test.js', 'Gruntfile.js', 'test.html'],
        tasks: ['default'],
        options: {
          interrupt: true,
          event: 'all'
        }
      }
    }
    
  }); 


  grunt.loadNpmTasks('grunt-webpack');
  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-watch')
  

  // default do nothing
  grunt.registerTask('default', ['build', 'watch']);
  
  grunt.registerTask('test', ['build', 'clean:tests', 'webpack:specs', 'jasmine']);
  grunt.registerTask('build', ['clean:dist', 'webpack:lib']);
  
};
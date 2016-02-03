angular.module( 'app.createContainer', [
  'ui.router',
  'ui.bootstrap'
])

.config( function config( $stateProvider ) {
  var home = 'home';
  $stateProvider
    .state( 'createContainerMain', {
      parent: home,
      onEnter: function onEnter( $modal, $state ) {
        $modal
          // handle modal open
          .open({
            // main view
            templateUrl: 'containers/createContainer/createContainer.tpl.html',
            controller: 'CreateContainerCtrl'
          })
          .result.then( function() {
            // after clicking OK button
            $state.transitionTo(home);
          }, function() {
            // after clicking Cancel button or clicking background
            $state.transitionTo(home);
          });
      }
    })
    .state('createContainer', {
      url: 'images/:name/create',
      parent: 'createContainerMain',
      // nestead views
      views: {
        "bindingAddress@": {
          controller: 'BindingAddressCtrl',
          templateUrl: 'containers/bindingAddress/bindingAddress.tpl.html'
        }
      }
    })
  ;
})

.controller( 'CreateContainerCtrl', 
  function CreateContainerCtrl( $scope, $rootScope, $stateParams, Cookies, Config, Image, Container, Env ) {

  var imageName = decodeURIComponent($stateParams.name);

  $scope.settings = Cookies.settings;
  $scope.hostVolumes = [];
  $scope.environmentVariables = [];

  //commented this to avoid confusion
  // $scope.limits = {
  //   memory: '1.5',
  //   swap: '0',
  //   cpu: '50'
  // };

  Image.get({ id: imageName }, function( image ) {
    $scope.image = image;
    $scope.bindingPorts = image.Config.ExposedPorts;
    $scope.environmentVariables = image.Config.Env;

    //remove PATH from environment variables. May be a dirty hack
    if ($scope.environmentVariables[0].indexOf("PATH=") === 0) $scope.environmentVariables.splice(0, 1);
  });

  Config.get({}, function( config ) {
    $scope.config = config;
  });

  $scope.env = Env.get({});

  $scope.restartPolicy = {
    value: {}
  };

  $scope.create = function() {
    var bindingVolumes = [];
    var i = 0;
    for (var volume in $scope.image.Config.Volumes) {
      var key = $scope.hostVolumes[i]; i++;
      if(key) {
        bindingVolumes.push(key+':'+volume);
      }
    }    
    if ( $scope.config.docker ) {
      bindingVolumes.push('/var/run/docker.sock:/var/run/docker.sock');
      bindingVolumes.push($scope.env.DOCKER + ':/bin/docker');
    }

    removeBadEnvironmentVariables();

    Container.create({
      Image: imageName,
      name: $scope.name,
      env: $scope.environmentVariables,
      Hostname: $scope.name//,
      //Memory: $scope.limits.memory*1073741824,
      //MemorySwap: $scope.limits.swap//,
      //CpuShares: 1024*$scope.limits.cpu/100
    }, function( created ) {
      console.log('Container created.');
      if ( $scope.config.startContainersAfterCreation ) {
        Container.start({ 
          id: created.Id, 
          PublishAllPorts: true,
          Binds: bindingVolumes,
          PortBindings: getPortBindings($scope.bindingPorts),
          RestartPolicy: $scope.restartPolicy.value   
        }, function() {
          console.log('Container started.');
        });
      }
      // close after creation
      $scope.$close();
    });
  };

  var getPortBindings = function( data ) {
    for(var i in data) {
      var arr = [];
      arr.push(data[i]);
      data[i] = arr;
    }
    return data;
  };

  var removeBadEnvironmentVariables = function() {
    var i = $scope.environmentVariables.length;
    while (i--) {
      var element = $scope.environmentVariables[i];
      if (element === undefined || element === null || element.indexOf("=") === -1) {
        $scope.environmentVariables.splice(i, 1);
      }
    }
  };

  $scope.close = function() {
    $scope.$dismiss();
  };

})

;


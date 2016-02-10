angular.module( 'app.startContainer', [
  'ui.router',
  'ui.bootstrap'
])

.config( function config( $stateProvider ) {
  var home = 'home';
  $stateProvider
    .state( 'startContainerMain', {
      parent: home,
      onEnter: function onEnter( $modal, $state ) {
        $modal
          // handle modal open
          .open({
            // main view
            templateUrl: 'containers/startContainer/startContainer.tpl.html',
            controller: 'StartContainerCtrl'
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
    .state('startContainer', {
      url: 'containers/:name/start',
      parent: 'startContainerMain',
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

.controller( 'StartContainerCtrl', 
  function StartContainerCtrl( $scope, $stateParams, Cookies, ContainerService, Container, Config ) {

  $scope.settings = Cookies.settings;

  ContainerService.getByName( decodeURIComponent($stateParams.name) )
    .then(function( container ) {
      Container.get({ id: container.Id }, function( info ) {
        $scope.container = info;
      });
  });

  $scope.start = function() {

    var startContainerParams = {
      id: $scope.container.Id,
      privileged: true
    };

    Container.start(startContainerParams, function() {
      console.log('Container started.');
      ContainerService.update();
      $scope.$close();
    });
  };

  $scope.close = function() {
    $scope.$dismiss();
  };

})

;


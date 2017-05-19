angular.module( 'app.images', [
  //'ui.router'
])

/*
.config(function config( $stateProvider ) {
  $stateProvider
    .state( 'images', {
      url: '/images',
      views: {
        "images": {
          controller: 'ImagesCtrl',
          templateUrl: 'images/images.tpl.html'
        }
      }
    })
  ;
})
*/

.controller( 'ImagesCtrl', 
  function ImagesCtrl( $scope, $rootScope, $uibModal, $interval, Cookies, ImageService, $location ) {
  $scope.locationHost = $location.host();
  $scope.settings = Cookies.settings;
  $scope.searchThreshold = 30;
  $scope.viewLimit = 30;
  $scope.sortFirst = function (record) {
    if (!record.ParentId || record.ParentId === "") {
      return false;
    }
    return true;
  }
  $scope.sortSecond = function (record) {
    if (record.RepoTags && record.RepoTags[0] && (record.RepoTags[0].includes('server-') || record.RepoTags[0].includes('agent-') || record.RepoTags[0].includes('relay-'))) {
      return false;
    }
    return true;
  }
  $scope.sort = 'RepoTags'

  $scope.update = function() {
    ImageService.update();
  };
  var intervalPromise = $interval($scope.update, 15000);

  $scope.getContainersCount = function( data ) {
    var containers = [];
    for (var i in $scope.containers) {
      if( $scope.containers[i].Image == data.RepoTags[0] ) {
        containers.push($scope.containers[i]);
      }
    }
    return containers.length;
  };

  $scope.imageFilter = ImageService.imageFilter;

  $scope.$on('$destroy', function () { 
    $interval.cancel(intervalPromise);
  });

})

.service( 'ImageService', 
  function ( $rootScope, $q, Cookies, Image, ContainerService ) {
  var self = this;

  this.init = function() {
    if( !$rootScope.images) {
      return self.update();
    }
    return $q.when();
  };

  this.update = function() {
    var settings = Cookies.settings;

    var advancedView = function( data, filters ) {
      if( !settings.advanced ) {
        filters += '|!<none>|!alexagency/amhub';
      }
      return self.imageFilter(data, filters);
    };

    var deferred = $q.defer();
    Image.query({}, function( images ) {
      $rootScope.images = [];
      for(var i in images) {
        if( advancedView(images[i], settings.filter) ) {
          $rootScope.images.push(images[i]);
        }
      }
      return deferred.resolve();
    });
    return deferred.promise;
  };

  this.imageFilter = function( data, filters ) {
    if( !data.RepoTags ) {
      return false;
    }
    var name = data.RepoTags[0];
    filters = filters.split('|');
    for (var i in filters) {
      if( filters[i].charAt(0) != '!' && 
          name.indexOf(filters[i]) != -1 ) {
        return true;
      } else if( name.indexOf(filters[i].slice(1)) != -1 ) {
        return false;
      }
    }
    return false;
  };

  this.getAllByName = function( name ) {
    return self.init().then(function() {
      var images = [];
      for (var i in $rootScope.images) {
        var names = $rootScope.images[i].RepoTags;
        for (var j in names) {
          if( names[j] == name ) {
              images.push($rootScope.images[i]);
          }
        }
      }
      return images;
    });
  };

  this.remove = function( name ) {
    var removeImage = function( image ) {
      Image.remove({ id: image.Id }, function() {
        self.update();
        console.log('Image removed.');
      }, function (err) {
        alert(err.data);
      });
    }; 
    var removeAllImages = function( name ) {
      self.getAllByName( name ).then(function( images ) {
        for(var i in images) {
          removeImage(images[i]);  
        }
      });
    };
    return ContainerService.removeAllByImage( name )
      .then(function() {
        removeAllImages(name);
    });
  };

})

;


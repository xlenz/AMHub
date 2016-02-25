angular.module('app.containers', [])

  .controller('ContainersCtrl',
    function ContainersCtrl($scope, $uibModal, $interval, Cookies, ContainerService, ImageService, ContainerStartService, Container) {

      $scope.settings = Cookies.settings;
      $scope.searchThreshold = 30;
      $scope.viewLimit = 30;
      $scope.sort = '-Created';
      $scope.selectedAllContainers = false;
      $scope.visibleContainers = [];

      $scope.update = function () {
        if (!$scope.selectedAllContainers) {
          ContainerService.update();
        }
      };
      var intervalPromise = $interval($scope.update, 8000);

      ContainerService.update().then(ImageService.update());

      $scope.imageFilter = ContainerService.imageFilter;

      $scope.$on('$destroy', function () {
        $interval.cancel(intervalPromise);
      });

      $scope.selectAllContainers = function (visibleContainers) {
        $scope.visibleContainers = visibleContainers;
        $scope.selectedAllContainers = !$scope.selectedAllContainers;

        angular.forEach(visibleContainers, function (item) {
          item.Selected = $scope.selectedAllContainers;
        });
      };

      $scope.selectContainer = function (isSelected, visibleContainers) {
        $scope.visibleContainers = visibleContainers;
        if (isSelected) $scope.selectedAllContainers = true;
        else {
          var noCheckboxSelected = true;
          angular.forEach(visibleContainers, function (item) {
            if (noCheckboxSelected) {
              if (item.Selected) {
                noCheckboxSelected = false;
              }
            }
          });
          if (noCheckboxSelected) $scope.selectedAllContainers = false;
        }
      };

      $scope.actionSelected = function (actionSelectedName) {
        var selectedContainers = getSelectedContainers();
        if (selectedContainers.length === 0) return;

        if (confirm(actionSelectedName + " all selected containers (" + selectedContainers.length + ")?")) {
          switch (actionSelectedName) {
            case 'Start':
              angular.forEach(selectedContainers, function (containerId) {
                ContainerStartService.start(containerId);
              });
              $scope.selectedAllContainers = false;
              break;

            case 'Stop':
              angular.forEach(selectedContainers, function (containerId) {
                ContainerService.stop(containerId);
              });
              $scope.selectedAllContainers = false;
              break;

            case 'Remove':
              if (confirm("Double check before batch removal...")) {
                angular.forEach(selectedContainers, function (containerId) {
                  ContainerService.remove(containerId);
                });
                $scope.selectedAllContainers = false;
              }
              break;
          }
        }

      };

      function getSelectedContainers() {
        var selectedContainers = [];
        angular.forEach($scope.visibleContainers, function (item) {
          if (item.Selected) {
            selectedContainers.push(item.Id);
          }
        });
        return selectedContainers;
      }

      $scope.startContainer = function (containerId) {
        ContainerStartService.start(containerId);
      };
      $scope.stopContainer = function (containerId) {
        ContainerService.stop(containerId);
      };

    })

  .service('ContainerService',
    function ($rootScope, $q, Cookies, Config, Container) {
      var self = this;
      $rootScope.containers = [];

      this.init = function () {
        if (!$rootScope.containers) {
          return self.update();
        }
        return $q.when();
      };

      this.imageFilter = function (data, filters) {
        if (!data.Image) {
          return false;
        }
        var name = data.Image;
        filters = filters.split('|');
        for (var i in filters) {
          if (filters[i].charAt(0) != '!' &&
            name.indexOf(filters[i]) != -1) {
            return true;
          } else if (name.indexOf(filters[i].slice(1)) != -1) {
            return false;
          }
        }
        return false;
      };

      this.update = function () {
        var settings = Cookies.settings;

        var advancedView = function (data, filters) {
          if (!settings.advanced) {
            filters += '|!alexagency/amhub';
          }
          return self.imageFilter(data, filters);
        };

        var deferred = $q.defer();
        Container.query({}, function (containers) {
          for (var i in containers) {
            if (containers[i].Names && containers[i].Names[0]) {
              containers[i].Name = containers[i].Names[0].slice(1);
            }
          }
          $rootScope.containers = containers;
          return deferred.resolve();
        });
        return deferred.promise;
      };

      this.getByName = function (name) {
        return self.init().then(function () {
          for (var i in $rootScope.containers) {
            var container = $rootScope.containers[i];
            if (container.Name) {
              if (container.Name == name) {
                return container;
              }
            } else {
              return container; //return first container without name
            }
          }
        });
      };

      this.getActive = function () {
        return self.init().then(function () {
          var containers = [];
          for (var i in $rootScope.containers) {
            if ($rootScope.containers[i].Status.indexOf('Up') != -1) {
              containers.push($rootScope.containers[i]);
            }
          }
          return containers;
        });
      };

      this.getFreeAddresses = function () {
        var deferred = $q.defer();
        Config.get({}, function (config) {
          var addresses = config.addresses;
          self.init().then(function () {
            for (var i in $rootScope.containers) {
              var container = $rootScope.containers[i];
              for (var index in container.Ports) {
                if (container.Ports[index] && container.Ports[index].IP) {
                  var containerIp = container.Ports[index].IP;
                  if (containerIp != "0.0.0.0") {
                    for (var j in addresses) {
                      if (addresses[j].ip == containerIp) {
                        addresses.splice(j, 1);
                        break;
                      }
                    }
                  }
                }
              }
            }
            deferred.resolve(addresses);
          });
        });
        return deferred.promise;
      };

      this.remove = function (id) {
        return Container.remove({id: id}, function () {
          console.log('Container removed.');
          self.update();
        });
      };

      this.stop = function (id) {
        return Container.stop({id: id}, function () {
          console.log('Container stopped.');
          self.update();
        });
      };

      this.getAllByImage = function (imageName) {
        return self.init().then(function () {
          var imageContainers = [];
          for (var i in $rootScope.containers) {
            var container = $rootScope.containers[i];
            if (container.Image == imageName) {
              imageContainers.push(container);
            }
          }
          return imageContainers;
        });
      };

      this.removeAllByImage = function (imageName) {
        var deferred = $q.defer();
        self.init().then(function () {
          var promises = [];
          for (var i in $rootScope.containers) {
            var container = $rootScope.containers[i];
            if (container.Image == imageName) {
              promises.push(self.remove(container.Id));
            }
          }
          $q.all(promises)
            .then(function (resolutions) {
              return deferred.resolve();
            });
        });
        return deferred.promise;
      };

      this.getVisibleContainers = function () {
        console.log($rootScope.visibleContainers);
        return $rootScope.visibleContainers;
      }

    })

;

